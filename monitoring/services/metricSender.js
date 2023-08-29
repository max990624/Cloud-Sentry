class MetricSender {
  async send(podName, containerName, metricType, metrics) {
    // 전송할 데이터에 팟 이름과 컨테이너 이름 추가
    const data = {
      podName: podName,
      containerName: containerName,
      metricType: metricType,
      metrics: metrics
    };

    // 'sendToDestination' 메소드 호출
    // 'sendToDestination' 메소드는 각 서브 클래스에서 구현
    return await this.sendToDestination(data);
  }

  async sendToDestination(data) {
    throw new Error('sendToDestination() must be implemented by subclass!');
  }
}

module.exports = MetricSender;

/*
MetricSender 클래스 구조의 시각화

MetricSender (abstract class)
│
└───send(data) (common method)
    │   └───(common logic for creating data)
    │   └───sendToDestination(data) (abstract method)
    │
    ├───FileMetricSender (subclass)
    │   └───sendToDestination(data) (implementation for sending to a file)
    │
    └───ApiMetricSender (subclass)
        └───sendToDestination(data) (implementation for sending to an API)
*/