const k8s = require('@kubernetes/client-node');

// 쿠버네티스 클라이언트 설정
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// 컨테이너 이름 가져오기
async function getContainers() {
  try {
    const pods = await k8sApi.listNamespacedPod('monitor'); // monitor namespace
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
    // 중복된 노드 이름을 제거하기 위해 Set 사용
    const nodeNames = new Set(nodes.body.items.map(node => node.metadata.name));
    return Array.from(nodeNames);
  } catch (error) {
    console.error(`Error while getting nodes: ${error}`);
  }
}

module.exports = { getContainers, getPods, getNodes };
