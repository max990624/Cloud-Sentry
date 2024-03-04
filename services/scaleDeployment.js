require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const { k8sApi } = require('./kubernetes');

const app = express();
app.use(bodyParser.json()); // JSON 요청 본문을 파싱 -> body-parser

app.post('/scale', async (req, res) => {
    const { namespace, deploymentName, replicas } = req.body; // req(요청 본문)에서 namespace, deploymentName, replicas 값 추출.

    try {
        // deployment 조회
        const scaleResponse = await k8sApi.readNamespacedDeployment(deploymentName, namespace);
        const deployment = scaleResponse.body;

        // deployment의 replicas 필드를 변경(edit)
        deployment.spec.replicas = replicas;

        // 변경된 deployment로 해당 deployment를 대체(replace)하여 클러스터에 적용
        await k8sApi.replaceNamespacedDeployment(deploymentName, namespace, deployment);
        res.status(200).send(`Deployment ${deploymentName} scaled to ${replicas} replicas`);
    } catch (error) {
        console.error('Deployment 스케일링 에러:', error);
        res.status(500).send(`Deployment 스케일링 에러: ${error}`);
    }
});

const PORT = process.env.SCALER_PORT || 4000;
app.listen(PORT, () => {
    console.log(`서버가 ${PORT} 포트에서 실행 중입니다.`);
});

/**
 * 참조: https://github.com/kubernetes-client/javascript/blob/master/examples/scale-deployment.js
 */