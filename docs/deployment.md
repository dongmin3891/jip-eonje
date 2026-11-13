# 집언제: 홈서버 배포 체크리스트

이 문서의 설정은 기존 K3s + Traefik + Argo CD 환경을 가정한다.
도메인은 우선 `jip.ddongmy.com`으로 설정했다. 서버에 직접 적용한 상태는 아니다.

## 선행 작업

1. GitHub Actions가 GHCR로 이미지를 빌드·푸시하는지 확인한다.
2. `jip-eonje`가 private 저장소이므로 GitHub Packages의 컨테이너 이미지도 private일 수 있다. K3s에서 이를 pull할 수 있도록 `jip-eonje` 네임스페이스에 `ghcr-pull` imagePullSecret을 생성한다. 이미지 접근 권한이 있는 최소 권한 토큰(read:packages)을 사용한다.
3. `jip-eonje` 네임스페이스에 `jip-eonje-env` Secret을 생성한다. `DATA_GO_KR_SERVICE_KEY`, `KAKAO_MAP_JS_KEY`를 포함한다. `KAKAO_REST_API_KEY`는 단지 목록 생성 전용이라 런타임에는 넣지 않는다.
4. Cloudflare DNS에 `jip.ddongmy.com`을 서버의 기존 웹 진입점으로 연결한다.
5. Kakao Developers에 `https://jip.ddongmy.com` 웹 도메인을 허용한다.
6. 기존 클러스터의 인증서 발급 방식으로 `jip-eonje-tls` TLS Secret을 준비한다.
7. Argo CD에 private `jip-eonje` 저장소 읽기 권한을 부여한다.
8. `kubectl apply -f argocd/application.yaml`로 애플리케이션을 등록한다.

## Secret 예시

실제 키나 토큰을 레포에 커밋하지 말 것.

```sh
kubectl create namespace jip-eonje --dry-run=client -o yaml | kubectl apply -f -
kubectl -n jip-eonje create secret generic jip-eonje-env \
  --from-literal=DATA_GO_KR_SERVICE_KEY='<key>' \
  --from-literal=KAKAO_MAP_JS_KEY='<key>'
kubectl -n jip-eonje create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username='<github-user>' \
  --docker-password='<read-packages-token>'
```

쉘 기록에 민감값이 남지 않도록 실제 작업에서는 안전한 입력 방식 또는 Secret 관리 도구를 사용할 것.

## 운영 확인

```sh
kubectl -n jip-eonje get pods,svc,ingress
kubectl -n jip-eonje rollout status deployment/jip-eonje
kubectl -n jip-eonje logs deployment/jip-eonje --tail=100
curl -i https://jip.ddongmy.com/api/health
```

아직 실제 Docker 빌드, 클러스터 배포, DNS/인증서 및 API 키 작동 테스트는 진행되지 않았다.
