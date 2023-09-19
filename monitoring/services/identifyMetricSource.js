// metricType -> containerName, nodeName filter 로직
function getMetricNameBasedOnType(metricType, containerName, nodeName) {
    if (metricType.startsWith("kubernetes.io/container")) {
      return containerName;
    } else if (metricType.startsWith("kubernetes.io/node")) {
      return nodeName;
    }
  
    // 기본값 혹은 에러 처리
    // return null;
}

module.exports = { getMetricNameBasedOnType };