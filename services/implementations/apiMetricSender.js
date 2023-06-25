const axios = require('axios');
const MetricSender = require('../metricSender.js');

class APIMetricSender extends MetricSender {
  async sendToDestination(data) {
    // API_ENDPOINT와 API_KEY는 .env 파일에서 가져온 값입니다.
    const API_ENDPOINT = process.env.API_ENDPOINT;
    const API_KEY = process.env.API_KEY;

    try {
      const response = await axios({
        method: 'post',
        url: API_ENDPOINT,
        data: data,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY // API 서버가 API 키를 요구한다고 가정했을 때
        }
      });

      console.log(response.status, response.data);
    } catch (error) {
      console.error(`Failed to send metrics to API: ${error}`);
    }
  }
}

module.exports = APIMetricSender;
