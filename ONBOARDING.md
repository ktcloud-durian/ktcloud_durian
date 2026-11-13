# 팀원 시작 가이드 (처음 오셨다면 이것만 읽으세요)

## 1. 우리 레포 3개
| 레포 | 무엇이 있나 | 주로 수정하는 사람 |
|---|---|---|
| `ktcloud_durian` | 앱 코드, CI/배포 자동화(워크플로) | CI/CD 메인·보조 |
| `cicd-platform-gitops` | 배포 설정(매니페스트). 이미지 태그는 자동으로 바뀜 | 쿠버네티스·서비스 인프라 |
| `durian-infra` | AWS 서버·네트워크·S3 (Terraform) | 인프라 전원 |

## 2. 용어 한 줄 설명
- **브랜치**: main을 건드리지 않고 작업하는 내 작업 공간
- **커밋**: 변경을 저장하는 단위 / **푸시(Push)**: 내 커밋을 GitHub에 올리기
- **PR(Pull Request)**: "이 변경을 main에 합쳐 주세요"라는 **검토 요청서**
- **머지(Merge)**: 승인된 PR을 main에 합치기
- **CI**: PR을 올리면 자동으로 도는 검사(코드 검사, 테스트, 빌드)

## 3. 처음 한 번만 (GitHub Desktop)
1. GitHub Desktop 설치 후 로그인 (조직 `ktcloud-durian` 초대 수락)
2. File > Clone repository > `ktcloud-durian` 레포 선택 > Clone
3. 이름/이메일 설정(Configure Git): 이름은 본인 이름 또는 GitHub 아이디

## 4. 작업하는 방법 (매번 이 5단계)
1. **최신 받기**: Fetch origin → Pull origin
2. **브랜치 만들기**: Current Branch > New Branch. 이름 예: `feature/이름-작업내용`
3. **수정 후 Commit**: 왼쪽에서 변경 확인 → 제목 쓰고 Commit → **Push origin**
4. **PR 만들기**: Create Pull Request 클릭 → 브라우저에서 템플릿 채우고 생성
5. **검사 통과 + 승인 후 Merge**: 초록 체크(✅)가 뜨고 리뷰어가 승인하면 Merge

> **main에 직접 올리지 마세요.** 항상 브랜치 → PR로만 반영합니다.

## 5. Discord 알림 읽는 법
| 알림 | 뜻 | 내가 할 일 |
|---|---|---|
| ✅ 테스트 통과 | 자동 검사 성공 | 리뷰어 승인 후 머지 |
| ❌ 테스트 실패 | 검사 실패 (실패 단계 표시) | [실행 로그]에서 빨간 줄 확인 → 고쳐서 Push |
| 🚀 배포 반영 완료 | 새 이미지 태그가 배포 설정에 반영됨 | 서비스 동작 확인 |
| ❌ 빌드/배포 실패 | 빌드 또는 배포 단계 실패 | 직접 재시도하지 말고 로그 링크를 CI/CD 메인에게 공유 |

실패는 정상적인 과정입니다. 로그의 빨간 줄을 먼저 보세요.

## 6. 하면 안 되는 것
- main에 직접 push
- 비밀번호, 토큰, 키, AWS 계정 정보를 코드·채팅에 올리기
- 워크플로(`.github/`)와 Terraform을 리뷰 없이 수정
- 막혔을 때 혼자 오래 붙잡기 → **CI/CD 메인/보조에게 바로 문의**

## 7. 참고
- CI는 AWS의 러너 1대에서 돌고 **운영 시간이 정해져 있습니다.** 시간 밖에 올린 PR은 다음 운영 시간에 검사됩니다.
- 업데이트 공지가 오면 main을 **Pull** 받으세요.
- 인프라(`durian-infra`)는 PR을 올리면 `plan`(변경 미리보기)이 PR에 댓글로 달립니다. **삭제(destroy)가 보이면 머지 전에 꼭 리뷰를 요청하세요.**

<!-- ===== 연습 섹션 시작 (필요 없어지면 여기부터 끝 표시까지 삭제) ===== -->

## 8. 명령어로 따라 해보기 (연습)

GitHub Desktop 버튼으로 하는 일을 **명령어(터미널)로도 할 수 있습니다.** 명령어가 처음이어도 괜찮습니다. 아래를 **위에서부터 순서대로 한 줄씩 복사해서 실행**하고, "정상이면 이렇게 보입니다"와 비교해 보세요.

> 터미널 여는 법 (Windows): GitHub Desktop > Repository > **Open in Command Prompt** (또는 PowerShell).
> 이렇게 열면 **레포 폴더 안**에서 시작하므로 폴더 이동이 필요 없습니다.

> 모든 연습은 **내 컴퓨터에서만** 일어납니다. 아래 명령은 서버나 AWS를 바꾸지 않으니 안심하고 해보세요.

### 8-1. 지금 내 상태 확인하기 (언제 해도 안전)
```
git status
```
- 뜻: 내가 어느 브랜치에 있고, 바꾼 파일이 뭔지 보여줍니다.
- 정상: `On branch main` 또는 `On branch feature/...` 이 보입니다.

```
git branch --show-current
```
- 뜻: 지금 브랜치 이름만 출력합니다. **작업 전에 main이 아닌지 꼭 확인**하세요.

### 8-2. 브랜치 만들고 수정해서 PR까지 (Desktop 5단계의 명령어 버전)
```
git checkout main
git pull
```
- 뜻: main으로 이동하고 최신 내용을 받습니다.

```
git checkout -b feature/내이름-연습
```
- 뜻: `feature/내이름-연습`이라는 **내 작업 공간(브랜치)을 만들고** 그쪽으로 이동합니다. 이름의 `내이름` 부분만 바꾸세요. 예) `feature/kim-practice`

README.md를 열어 **맨 아래에 본인 이름 한 줄**을 추가하고 저장한 뒤:

```
git status
```
- 정상: `modified: README.md`가 빨간색으로 보입니다. (바뀐 파일 확인)

```
git add README.md
git commit -m "docs: 연습용 이름 추가"
```
- 뜻: `add`는 "이 파일을 저장 목록에 담기", `commit`은 "담은 것을 하나의 기록으로 저장"입니다. `-m` 뒤 따옴표 안은 **무엇을 바꿨는지 한 줄 설명**입니다.

```
git push -u origin feature/내이름-연습
```
- 뜻: 내 브랜치를 GitHub에 올립니다. 브랜치 이름은 위에서 만든 것과 같아야 합니다.
- 정상: 마지막에 `Create a pull request ... by visiting:` 와 **링크**가 나옵니다. 그 링크를 열어 PR을 만드세요.

그 다음은 Desktop과 같습니다. PR 생성 → 자동 검사(CI) ✅ → 리뷰어 승인 → Merge.

### 8-3. 올리기 전에 내 컴퓨터에서 미리 검사하기

PR을 올리면 서버가 자동으로 검사하지만, **미리 내 컴퓨터에서 같은 검사**를 해두면 실패를 줄일 수 있습니다. (레포 폴더 안에서 실행)

**앱 레포 (`ktcloud_durian`)** — Node.js가 설치되어 있어야 합니다.
```
cd app
npm install
npm run lint
npm test
```
- `npm run lint`: 코드 모양(문법, 스타일) 검사 / `npm test`: 테스트 실행
- 정상: 에러 없이 끝나고 `passing`(통과) 같은 문구가 보입니다.
- 실패: 빨간 줄의 **파일 이름과 줄 번호**를 보고 고치면 됩니다. 이것이 CI 실패와 같은 원인입니다.

**인프라 레포 (`durian-infra`)** — Terraform이 설치되어 있어야 합니다.
```
cd main
terraform fmt
terraform validate
```
- `terraform fmt`: 코드 줄 맞춤을 자동 정리 (파일이 바뀔 수 있음, 정상)
- `terraform validate`: 문법이 맞는지 검사. 정상: `Success! The configuration is valid.`
- `validate`가 `Missing required provider`를 말하면 먼저 `terraform init -backend=false`를 한 번 실행하세요. (서버에 접속하지 않고 준비만 합니다.)

> **`terraform apply`와 `terraform destroy`는 절대 직접 실행하지 마세요.** 서버를 만들거나 지우는 명령입니다. 인프라 변경은 **PR을 올리면 자동으로 `plan`(미리보기)이 댓글로 달리는 방식**으로만 진행합니다.

**배포 설정 레포 (`cicd-platform-gitops`)** — kustomize(또는 kubectl)가 설치되어 있다면:
```
kubectl kustomize apps/sample-app/overlays/staging
```
- 뜻: 배포 설정을 합친 결과를 화면에 **출력만** 합니다. (서버에 적용되지 않음)
- 정상: Deployment, Service 등 YAML이 길게 출력됩니다. 에러가 나면 YAML 들여쓰기를 먼저 확인하세요.

### 8-4. 실수했을 때 (되돌리기)
| 상황 | 명령 | 뜻 |
|---|---|---|
| 파일을 고쳤는데 **저장 전 상태로** 되돌리고 싶다 | `git restore 파일이름` | 그 파일의 수정을 취소 |
| `git add` 했는데 **담기를 취소**하고 싶다 | `git restore --staged 파일이름` | 저장 목록에서 빼기 (내용은 유지) |
| 커밋 메시지를 **방금 것만** 고치고 싶다 (아직 push 전) | `git commit --amend -m "새 설명"` | 마지막 기록 수정 |
| **main에서 작업해버렸다** (push 전) | `git checkout -b feature/새이름` | 지금 변경을 새 브랜치로 옮김. 그 뒤 commit/push |
| 뭘 해야 할지 모르겠다 | `git status` | 현재 상태 확인 후 메인에게 문의 |

> `git push --force`, `git reset --hard`는 **다른 사람의 작업을 지울 수 있으니 쓰지 마세요.** 필요하다면 먼저 메인에게 물어보세요.

### 8-5. 자주 만나는 오류
| 보이는 문구 | 뜻 | 해결 |
|---|---|---|
| `fatal: not a git repository` | 레포 폴더 밖에서 실행했다 | GitHub Desktop의 Open in Command Prompt로 다시 열기 |
| `error: pathspec ... did not match` | 파일/브랜치 이름이 틀렸다 | 오타 확인, `git status`로 이름 확인 |
| `Your branch is behind 'origin/main'` | main이 최신이 아니다 | `git pull` |
| `CONFLICT (content): Merge conflict` | 같은 줄을 다른 사람과 같이 고쳤다 | **혼자 해결하려 하지 말고** 메인에게 화면을 공유 |
| `command not found` / 인식되지 않습니다 | 프로그램이 설치되어 있지 않다 | 해당 도구(Node.js, Terraform 등) 설치 여부를 메인에게 문의 |
| push 시 `Permission denied` / `403` | 권한이 없는 레포이다 | 내 권한(Read/Write)을 메인에게 확인 |

<!-- ===== 연습 섹션 끝 ===== -->
