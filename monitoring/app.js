require('dotenv').config();

const express = require('express');
const axios = require('axios');

const { getMetric } = require('./services/monitoring.js');
const { getContainers, getPods, getNodes } = require('./services/kubernetes.js');
const ApiMetricSender = require('./apiMetricSender.js');
const FileMetricSender = require('./fileMetricSender.js');

// 전략 선택: 사용자 입력 또는 환경 변수 등으로부터 메트릭 전송 방식 결정
const metricSenderType = process.env.METRIC_SENDER_TYPE || 'file'; // 예를 들어, 환경 변수를 사용

let metricSender;
switch(metricSenderType) {
  case 'api':
    metricSender = new ApiMetricSender();
    break;
  case 'file':
  default:
    metricSender = new FileMetricSender();
    break;
}

const app = express();

async function collectAndSendMetrics() {
  try {
    // 각 유형의 선택된 모든 리소스(metricTypes) 가져오기
    const containerNames = await getContainers();
    const podNames = await getPods();
    const nodeNames = await getNodes();

    const metricTypes = [
      // Container metrics
      "kubernetes.io/container/cpu/core_usage_time",
      "kubernetes.io/container/cpu/limit_utilization",
      "kubernetes.io/container/cpu/request_utilization",
      "kubernetes.io/container/memory/limit_utilization",
      "kubernetes.io/container/memory/request_utilization",
      "kubernetes.io/container/memory/used_bytes",
      "kubernetes.io/container/restart_count",
      // Node metrics
      "kubernetes.io/node/network/received_bytes_count",
      "kubernetes.io/node/node/network/sent_bytes_count"
    ];

    // 선택된 MetricSender의 전략을 사용하여 메트릭 보내기
    const containerMetrics = await Promise.all(containerNames.map(container => Promise.all(metricTypes.map(type => getMetric(container.podName, container.containerName, type)))));
    // const podMetrics = await Promise.all(podNames.map(podName => Promise.all(metricTypes.map(type => getMetric(podName, null, type)))));
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
