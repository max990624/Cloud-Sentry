const axios = require('axios');
const { Readable } = require('stream');
const MetricSender = require('../metricSender.js');

class APIMetricSender extends MetricSender {
  async sendToDestination(data) {
    const API_ENDPOINT = process.env.API_ENDPOINT;
    const API_KEY = process.env.API_KEY;

    // 데이터를 스트림으로 변환
    const stream = new Readable();
    stream.push(JSON.stringify(data)); // 데이터를 스트림에 추가
    stream.push(null); // 스트림의 끝을 표시

    try {
      const response = await axios({
        method: 'post',
        url: API_ENDPOINT,
        data: stream, // 데이터로 스트림을 보냄
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'Transfer-Encoding': 'chunked'
        }
      });

      console.log(`${response.status}, ${JSON.stringify(response.data)}`); // 응답 상태와 데이터 로그
    } catch (error) {
      console.error(`API로 메트릭을 보내는 데 실패했습니다: ${error}`); // 오류 처리
    }
  }
}

module.exports = APIMetricSender;
