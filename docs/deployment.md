# 배포 가이드

[README](../README.md) · [개발 가이드](development.md)

이 저장소는 **GitHub Actions → GHCR → Argo CD → K3s** 흐름으로 배포하도록 구성되어 있습니다. Traefik과 cert-manager가 설치된 클러스터를 전제로 합니다.

아래 내용은 저장소 설정을 설명합니다. 실제 클러스터의 배포 상태, DNS·인증서, 외부 API 키의 작동 여부는 운영 점검 단계에서 별도로 확인하세요.

## 배포 구성

| 항목 | 저장소 설정 |
| --- | --- |
| 서비스 도메인 | `jip.ddongmy.com` |
| 컨테이너 이미지 | `ghcr.io/dongmin3891/jip-eonje:<커밋 SHA>` |
| 네임스페이스 / Deployment | `jip-eonje` |
| Service | `jip-eonje-service`, `80 → 3000` |
| Ingress | `jip-eonje-ingress`, 클래스 `traefik` |
| 런타임 환경변수 Secret | `jip-eonje-env` |
| 이미지 인증 Secret | `ghcr-pull` |
| Certificate / TLS Secret | `jip-eonje-prod-cert` / `jip-eonje-tls` |
| ClusterIssuer | `letsencrypt-prod` |
| 상태 확인 경로 | `/api/health` |

관련 파일은 [Dockerfile](../Dockerfile), [워크플로](../.github/workflows/deploy.yml), [Kubernetes 매니페스트](../k8s/), [Argo CD Application](../argocd/application.yaml)입니다.

## 로컬에서 컨테이너 확인

Docker 실행 전에 README의 `.env.local` 설정을 준비합니다. 아래 명령은 저장소 루트에서 실행합니다.

```bash
docker build -t jip-eonje:local .
docker run --rm --name jip-eonje-local \
  -p 4317:3000 \
  --env-file .env.local \
  jip-eonje:local
```

다른 터미널에서 상태 응답을 확인합니다.

```bash
curl -fsS http://localhost:4317/api/health
```

정상 응답은 `{"status":"ok"}`입니다. 이 경로는 앱 응답 여부만 확인하므로 지도와 실거래 조회도 브라우저에서 확인해야 합니다.

Docker는 Node.js 22 Alpine으로 의존성 설치·빌드·실행 단계를 분리합니다. 최종 이미지는 일반 사용자 `node`로 standalone의 `server.js`를 실행하고, `public`과 `.next/static`도 포함합니다. 환경변수 파일은 [.dockerignore](../.dockerignore)에서 제외되며 키는 컨테이너 실행 시 전달합니다.

## 최초 배포 준비

1. **클러스터**: K3s, Traefik, Argo CD, cert-manager와 `letsencrypt-prod` ClusterIssuer를 준비합니다. 적용 전 `kubectl`의 현재 컨텍스트를 확인합니다.
2. **저장소 접근**: Argo CD가 비공개 GitHub 저장소를 읽을 수 있도록 자격증명을 등록합니다.
3. **이미지 게시**: GitHub Actions에 Packages 쓰기 권한과 배포 이미지 갱신 커밋을 push할 권한이 있어야 합니다. 브랜치 보호 규칙도 이 흐름과 맞아야 합니다.
4. **DNS**: Cloudflare에서 `jip.ddongmy.com`을 클러스터의 웹 진입점으로 연결합니다. 인증서 검증 방식은 기존 ClusterIssuer 설정에 맞춥니다.
5. **지도 도메인**: Kakao Developers에 `https://jip.ddongmy.com`을 허용합니다.
6. **Secret**: 아래 절차로 앱 환경변수와 GHCR 인증 정보를 준비합니다.
7. **이미지 존재 여부**: [deployment.yaml](../k8s/deployment.yaml)의 이미지 태그가 GHCR에 게시되어 있는지 확인합니다.

다른 도메인이나 인증서 발급자를 사용한다면 [ingress.yaml](../k8s/ingress.yaml)과 [certificate.yaml](../k8s/certificate.yaml)을 함께 변경합니다.

### 앱 환경변수

먼저 네임스페이스를 생성합니다.

```bash
kubectl config current-context
kubectl apply -f k8s/namespace.yaml
```

저장소 밖의 접근이 제한된 파일에 다음 두 항목을 `이름=값` 형식으로 준비합니다. 아래 값은 자리표시자입니다.

```dotenv
DATA_GO_KR_SERVICE_KEY=<공공데이터포털 인증키>
KAKAO_MAP_JS_KEY=<카카오 JavaScript 키>
```

파일 경로를 실제 경로로 바꾼 뒤 Secret을 생성합니다.

```bash
kubectl -n jip-eonje create secret generic jip-eonje-env \
  --from-env-file=/secure/path/jip-eonje.env
```

`KAKAO_REST_API_KEY`는 데이터 생성 전용이므로 운영 Secret에는 필요하지 않습니다. 키나 토큰을 문서·매니페스트에 직접 적어 커밋하지 않습니다.

### 비공개 이미지 인증

이미지를 읽을 수 있는 GitHub 계정과 `read:packages` 권한으로 GHCR 인증을 준비합니다. 인증 정보는 원격 저장소 접근용 Argo CD 자격증명과 별개입니다.

아래 예시는 `auths.ghcr.io`에 사용할 인증 정보가 포함된 Docker 설정 파일을 이미 준비한 경우입니다. 외부 자격증명 도우미만 참조하는 파일은 그대로 사용할 수 없습니다.

```bash
kubectl -n jip-eonje create secret generic ghcr-pull \
  --type=kubernetes.io/dockerconfigjson \
  --from-file=.dockerconfigjson=/secure/path/ghcr-config.json
```

기존 Secret이 있다면 현재 사용하는 Secret 관리 절차로 갱신합니다. 환경변수 Secret을 변경한 뒤에는 아래와 같이 Pod를 재시작해야 새 값이 반영됩니다.

```bash
kubectl -n jip-eonje rollout restart deployment/jip-eonje
kubectl -n jip-eonje rollout status deployment/jip-eonje
```

## Argo CD 등록과 자동 배포

```bash
kubectl apply -f argocd/application.yaml
```

Application은 `main` 브랜치의 `k8s/`를 감시하고 자동 동기화합니다. `prune`과 `selfHeal`이 켜져 있어 Git에서 제거한 리소스는 정리하고 클러스터의 수동 변경은 Git 상태로 되돌립니다. Certificate도 이 경로에 있으므로 cert-manager가 `letsencrypt-prod`를 통해 `jip-eonje-tls`를 발급·갱신하도록 구성되어 있습니다.

GitHub Actions의 배포 순서는 다음과 같습니다.

1. `main` push 또는 수동 실행으로 시작합니다. 변경 파일이 `k8s/**`에만 있으면 push 실행을 건너뜁니다.
2. `npm ci`, 타입 검사, 린트, Jest 테스트를 실행합니다.
3. Docker 이미지를 빌드하고 커밋 SHA 태그와 `latest` 태그로 GHCR에 게시합니다.
4. `k8s/deployment.yaml`의 이미지를 해당 SHA 태그로 바꾸고 커밋·push합니다.
5. Argo CD가 변경된 매니페스트를 감지해 적용합니다.

빌드·검사가 실패하면 새 이미지 갱신 단계로 진행하지 않습니다. 실제 배포 대상은 Deployment에 기록된 SHA 태그입니다.

## 운영 점검

```bash
kubectl -n argocd get application jip-eonje
kubectl -n jip-eonje get pods,svc,ingress
kubectl -n jip-eonje rollout status deployment/jip-eonje
kubectl -n jip-eonje get certificate jip-eonje-prod-cert
kubectl -n jip-eonje logs deployment/jip-eonje --tail=100
curl -fsS https://jip.ddongmy.com/api/health
```

확인할 항목:

- Argo CD의 동기화·상태 결과와 배포 이미지 SHA가 예상한 버전인지
- Pod가 준비 상태이고 Certificate가 발급 완료 상태인지
- HTTPS에서 지도와 단지 검색이 동작하는지
- 단지 상세에서 실거래 조회와 SH 공식 링크가 동작하는지

현재 Deployment는 Pod 1개를 사용하며 startup·readiness·liveness probe가 모두 `/api/health`를 호출합니다. 실거래 캐시와 요청 제한은 Pod 메모리에 있으므로 재시작 시 초기화됩니다.

## 장애 확인과 롤백

| 증상 | 먼저 확인할 곳 |
| --- | --- |
| `ImagePullBackOff` | SHA 이미지 존재 여부, `ghcr-pull`의 계정·패키지 접근 권한 |
| `CreateContainerConfigError` | 같은 네임스페이스에 `jip-eonje-env`가 있는지 |
| HTTPS 연결·인증서 오류 | DNS, Traefik, ClusterIssuer, Certificate 상태 |
| 검색은 되지만 지도는 미설정·오류 | JavaScript 키, 운영 도메인 허용, Secret 변경 후 재시작 여부 |
| 실거래 `KEY_MISSING`·`KEY_INVALID` | Secret의 키 이름·값, API 활용 승인·허용 IP |
| 실거래 429 | 앱의 분당 요청 제한 또는 외부 API 호출 한도 |
| 상태 확인은 성공하지만 계약 조회 실패 | 외부 API 응답과 [오류 코드](development.md#오류-응답) |

롤백은 Git에서 `k8s/deployment.yaml`의 이미지 태그를 GHCR에 남아 있는 이전 정상 SHA로 되돌리고 커밋·push하는 방식으로 진행합니다. Argo CD의 동기화와 rollout 결과를 확인하세요. `kubectl rollout undo`만 실행하면 `selfHeal`이 Git의 이미지로 다시 맞출 수 있습니다.
