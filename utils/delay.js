// 15초 대기 함수
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = delay;
