const fs = require('fs');
const MetricSender = require('../metricSender.js');
const { getMetricNameBasedOnType } = require('../identifyMetricSource.js');

class FileMetricSender extends MetricSender {
  async sendToDestination(data) {
    const dir = './metrics';
    const timestamp = new Date().toISOString().replace(/[:]/g, "-"); // ":"는 파일 이름에 사용할 수 없으므로 "-"로 대체
    const sanitizedMetricType = data.metricType.replace(/\//g, '-'); // 모든 슬래시를 대쉬로 변경

    let nameForFile = getMetricNameBasedOnType(data.metricType, data.containerName, data.nodeName);

    // 메트릭 폴더가 없는 경우 생성
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    // 메트릭을 JSON 파일로 저장
    try {
      //fs.writeFileSync(`${dir}/${data.containerName}-${sanitizedMetricType}-${timestamp}.json`, JSON.stringify(data, null, 2));
      fs.writeFileSync(`${dir}/${nameForFile}-${sanitizedMetricType}-${timestamp}.json`, JSON.stringify(data));

      console.log(`${nameForFile}-${data.metricType} 메트릭이 성공적으로 JSON 파일에 저장되었습니다.`);
    } catch (err) {
      console.error(`${nameForFile}-${data.metricType} 메트릭을 JSON 파일로 저장하는 동안 오류 발생:`, err);
    }
  }
}

module.exports = FileMetricSender;
