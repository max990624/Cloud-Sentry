const monitoring = require('@google-cloud/monitoring');
const MetricSender = require('./metricSender.js');
const FileMetricSender = require('./fileMetricSender.js');

// MetricSender 인스턴스 생성
const metricSender = new FileMetricSender();

// 모니터링 클라이언트 생성
const client = new monitoring.MetricServiceClient({
  keyFilename: 'cloud-sentry-386420-ed4d3bd8e36d.json'
});

// 프로젝트 ID 설정
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

//
async function getMetric(podName, containerName, metricType, retryCount = 0) {
  const startTime = new Date(new Date().getTime() - 60000); // 현재 시간으로부터 2분(120000 밀리초) 전을 시작 시간으로 설정
  const endTime = new Date(startTime.getTime() + 60000); // 시작 시간으로부터 1분(60000 밀리초) 후를 종료 시간으로 설정  

  const request = {
    name: client.projectPath(projectId),
    filter: `metric.type = "${metricType}" AND resource.labels.container_name = "${containerName}"`,
    interval: {
      startTime: {
        seconds: Math.floor(startTime.getTime() / 1000),
      },
      endTime: {
        seconds: Math.floor(endTime.getTime() / 1000),
      },
    },
  };

  console.log(`${containerName}에 대한 ${metricType} 메트릭 요청 중`);

  try {
    const [timeSeries] = await client.listTimeSeries(request);
    console.log(`${containerName}에 대한 ${metricType} 시계열 데이터 수신`);

    let metrics = timeSeries.map(data => {
      return {
        metricType: data.metric.type,
        metricKind: data.metricKind,
        valueType: data.valueType,
        values: data.points.map(point => ({
          timestamp: point.interval.endTime.seconds,
          value: point.value.doubleValue
        }))
      };
    });
    console.log(`${containerName}에 대한 ${metricType} 메트릭 처리 완료`);

    // MetricSender를 사용하여 메트릭 보내기
    metricSender.send(podName, containerName, metricType, metrics);

    return metrics;
    /** try..catch에서 consle.error containerName만 나오는 문제 해결필요 */
  } catch (error) {
    if (retryCount < 4) {
      console.log(`${containerName}에 대한 ${metricType} 메트릭 요청 재시도 (${retryCount + 1}번째)`);
      await delay(15000); // 15초 대기
      return getMetric(podName, containerName, metricType, retryCount + 1);
    } else {
      /** 어떤 오류인지에 대해 추가 확인 필요 */
      console.error(`${containerName}에 대한 ${metricType} 메트릭 요청 중 오류 발생: ${error}`);
    }
  }
}

module.exports = { getMetric };