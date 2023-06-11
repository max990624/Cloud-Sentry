const monitoring = require('@google-cloud/monitoring');
const k8s = require('@kubernetes/client-node');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

// 모니터링 클라이언트 생성
const client = new monitoring.MetricServiceClient({
  keyFilename: 'cloud-sentry-386420-ed4d3bd8e36d.json'
});

// 프로젝트 ID 설정
const projectId = 'cloud-sentry-386420';

// 쿠버네티스 클라이언트 설정
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// 컨테이너 이름 가져오기
async function getContainers() {
  try {
    const pods = await k8sApi.listNamespacedPod('monitor');
    const containers = [];

    for (const pod of pods.body.items) {
      const podName = pod.metadata.name;
      for (const container of pod.spec.containers) {
        containers.push({
          podName: podName,
          containerName: container.name
        });
      }
    }

    return containers;
  } catch (error) {
    console.error(`Error while getting container names: ${error}`);
  }
}

// 팟 이름 가져오기
async function getPods() {
  try {
    const pods = await k8sApi.listNamespacedPod('monitor');
    const podNames = pods.body.items.map(pod => pod.metadata.name);

    return podNames;
  } catch (error) {
    console.error(`Error while getting pod names: ${error}`);
  }
}

// 노드 이름 가져오기
async function getNodes() {
  try {
    const nodes = await k8sApi.listNode();

    return nodes.body.items.map(node => node.metadata.name);
  } catch (error) {
    console.error(`Error while getting nodes: ${error}`);
  }
}

// 메트릭 저장 함수
async function saveMetricsToFile(podName, containerName, metricType, metrics) {
  const dir = './metrics';
  const timestamp = new Date().toISOString().replace(/[:]/g, "-"); // ":"는 파일 이름에 사용할 수 없으므로 "-"로 대체
  const sanitizedMetricType = metricType.replace(/\//g, '-'); // 모든 슬래시를 대쉬로 변경

  // 메트릭 폴더가 없는 경우 생성
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  // JSON 데이터에 팟 이름과 컨테이너 이름 추가
  const data = {
    podName: podName,
    containerName: containerName,
    metricType: metricType,
    metrics: metrics
  };

  // 메트릭을 JSON 파일로 저장
  try {
    fs.writeFileSync(`${dir}/${containerName}-${sanitizedMetricType}-${timestamp}.json`, JSON.stringify(data, null, 2));
    console.log(`${containerName}-${metricType} 메트릭이 성공적으로 JSON 파일에 저장되었습니다.`);
  } catch (err) {
    console.error(`${containerName}-${metricType} 메트릭을 JSON 파일로 저장하는 동안 오류 발생:`, err);
  }
}

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

    // 메트릭을 JSON 파일로 저장
    await saveMetricsToFile(podName, containerName, metricType, metrics);

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

// 15초 대기 함수
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const app = express();

async function collectAndSendMetrics() {
  try {
    // 각 유형의 모든 리소스 가져오기
    const containerNames = await getContainers();
    const podNames = await getPods();
    const nodeNames = await getNodes();

    const metricTypes = [
      // Container metrics
      "kubernetes.io/container/cpu/core_usage_time",
      "kubernetes.io/container/cpu/limit_utilization",
      "kubernetes.io/container/memory/usage_bytes",
      "kubernetes.io/container/memory/limit_utilization",
      // Pod metrics
      "kubernetes.io/pod/network/received_bytes_count",
      "kubernetes.io/pod/network/sent_bytes_count",
      // Node metrics
      "kubernetes.io/node/cpu/core_usage_time",
      "kubernetes.io/node/cpu/allocatable_utilization",
      "kubernetes.io/node/memory/used_bytes",
      "kubernetes.io/node/memory/allocatable_utilization",
      "kubernetes.io/node/network/received_bytes_count ",
      "kubernetes.io/node/network/sent_bytes_count "
    ];

    // 각 컨테이너, 팟, 노드의 모든 메트릭을 수집하고 JSON 파일로 저장합니다.
    const containerMetrics = await Promise.all(containerNames.map(container => Promise.all(metricTypes.map(type => getMetric(container.podName, container.containerName, type)))));
    const podMetrics = await Promise.all(podNames.map(podName => Promise.all(metricTypes.map(type => getMetric(podName, null, type)))));
    const nodeMetrics = await Promise.all(nodeNames.map(nodeName => Promise.all(metricTypes.map(type => getMetric(null, nodeName, type)))));
  } catch (error) {
    console.error(`메트릭을 수집하고 전송하는 동안 오류가 발생했습니다: ${error}`);
  }
}

app.get('/metrics', async (req, res) => {
  // 메트릭을 수집하고 JSON 파일로 저장한 후 응답으로 반환합니다.
  const metrics = await collectAndSendMetrics();
  res.json(metrics);
});

app.listen(3000, () => {
  console.log('서버가 포트 3000에서 실행 중입니다.');
  collectAndSendMetrics(); // 서버가 시작되면 collectAndSendMetrics 함수를 처음 호출합니다.
});
