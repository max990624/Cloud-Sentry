# Cloud-Sentry

## gcloud CLI
### install
https://cloud.google.com/sdk/docs/install-sdk?hl=ko

### gcloud CLI 도구를 사용하여 프로젝트와 클러스터 설정 및 인증
```
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]
gcloud container clusters get-credentials [YOUR_CLUSTER_NAME] --zone [YOUR_ZONE]
```