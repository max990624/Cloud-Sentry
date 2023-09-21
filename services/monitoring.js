const monitoring = require('@google-cloud/monitoring');
const MetricSender = require('./metricSender.js');
const FileMetricSender = require('./implementations/fileMetricSender.js');
const delay = require('../utils/delay.js');
const { getMetricNameBasedOnType } = require('./identifyMetricSource.js')

// MetricSender 인스턴스 생성
const metricSender = new FileMetricSender();

// 모니터링 클라이언트 생성
const client = new monitoring.MetricServiceClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// 프로젝트 ID 설정
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

// container, node filter 로직
function createFilter(metricType, containerName, nodeName) {
  if (metricType.startsWith("kubernetes.io/container")) {
    return `metric.type = "${metricType}" AND resource.labels.container_name = "${containerName}"`;
  } else if (metricType.startsWith("kubernetes.io/node")) {
    return `metric.type = "${metricType}" AND resource.labels.node_name = "${nodeName}"`;
  }

  // 기본값 혹은 에러 처리
  return null;
}

//
async function getMetric(podName, containerName, nodeName, metricType, retryCount = 0) {
  const setStartIntervalTimeInMS = 2 * 24 * 60 * 60 * 1000; // 2일전
  const setIntervalTimeInMs = 1 * 24 * 60 * 60 * 1000; // 1일전
  const startTime = new Date(new Date().getTime() - setStartIntervalTimeInMS); // 현재 시간으로부터 n밀리초 전을 시작 시간으로 설정
  const endTime = new Date(startTime.getTime() + setIntervalTimeInMs); // 시작 시간으로부터 n밀리초 후를 종료 시간으로 설정

  let filter = createFilter(metricType, containerName, nodeName);
  let nameForLog= getMetricNameBasedOnType(metricType, containerName, nodeName);

  // metricType이 문자열인지 확인
  if (typeof metricType !== 'string') {
    console.error(`Invalid metricType: ${metricType}, type: ${typeof metricType}`);
    return;
  }

  const request = {
    name: client.projectPath(projectId),
    filter: filter,
    interval: {
      startTime: {
        seconds: Math.floor(startTime.getTime() / 1000),
      },
      endTime: {
        seconds: Math.floor(endTime.getTime() / 1000),
      },
    },
  };

  console.log(`${nameForLog}에 대한 ${metricType} 메트릭 요청 중`);

  try {
    const [timeSeries] = await client.listTimeSeries(request);
    console.log(`${nameForLog}에 대한 ${metricType} 시계열 데이터 수신`);

    let metrics = [];
    
    for (let data of timeSeries) {
      for (let point of data.points) {
        metrics.push({
          valueType: data.valueType,
          timestamp: point.interval.endTime.seconds,
          value: point.value.doubleValue
        });
      }
    }

    console.log(`${nameForLog}에 대한 ${metricType} 메트릭 처리 완료`);

    // MetricSender를 사용하여 메트릭 보내기
    metricSender.send(podName, containerName, nodeName, metricType, metrics);

    return metrics;
  } catch (error) {
    if (retryCount < 4) {
      console.log(`${nameForLog}에 대한 ${metricType} 메트릭 요청 재시도 (${retryCount + 1}번째)`);
      await delay(15000); // 15초 대기
      return getMetric(podName, containerName, nodeName, metricType, retryCount + 1);
    } else {
      const errorMessage = `${nameForLog}에 대한 ${metricType} 메트릭 요청 중 오류 발생: ${error.message}`;
      const errorName = `오류 이름: ${error.name}`;
      const errorStack = `스택 트레이스: ${error.stack}`;
  
      console.error(`${errorMessage}\n${errorName}\n${errorStack}`);
    }
  }
}

module.exports = { getMetric, getMetricNameBasedOnType };