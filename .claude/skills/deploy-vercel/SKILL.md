---
name: deploy-vercel
description: "Physical AI Radar를 Vercel에 배포하는 스킬. 'vercel 배포', '배포해줘', 'deploy', '프로덕션 올려줘' 요청 시 이 스킬을 사용할 것. GitHub push와 Vercel production 배포를 자동으로 수행한다."
---

# Vercel Deploy

Physical AI Radar를 GitHub에 push하고 Vercel production에 배포한다.

## 사전 조건
- `npm run build` 통과 필수
- Git working tree가 clean이거나, 커밋할 변경사항이 있어야 한다

## 절차

1. **빌드 검증**: `npm run build` 실행하여 TypeScript 에러 없이 빌드 통과 확인
2. **Git 커밋**: 변경사항이 있으면 의미 있는 커밋 메시지로 커밋
3. **GitHub Push**: `git push origin main`
4. **Vercel 배포**: 
   ```bash
   VERCEL_TOKEN="..." vercel deploy --prod --scope terry-ums-projects
   ```
5. **결과 보고**: 배포 URL과 빌드 상태 반환

## 환경 정보
- Vercel scope: `terry-ums-projects`
- Vercel project: `news-rnd-physicalai-beauty`
- GitHub repo: `terryum/news-rnd-physicalai-beauty`
- VERCEL_TOKEN: `terry.env`에서 로드 (`/Users/terrytaewoongum/.config/claude-profiles/terry.env`)

## 주의사항
- SSL MITM 환경: `NODE_EXTRA_CA_CERTS` 설정이 필요할 수 있음 (회사 네트워크)
- Vercel은 GitHub 연동되어 있어 push만으로도 자동 배포됨. `vercel deploy --prod`는 즉시 배포가 필요할 때 사용
