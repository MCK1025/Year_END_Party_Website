# 행사 종료 후 개인정보 파기

1. 보관이 필요한 집계만 목적과 보관 기간을 정해 제한된 위치에 내려받습니다. 전체 설문·추천 원본이 꼭 필요한지 먼저 확인합니다.
2. 관리자 → 설정에서 직원 사이트 접속 허용을 끕니다. 서버가 신규 조회·쓰기·공개 진행을 차단합니다.
3. 확인 문구 `개인정보 영구 삭제`를 입력하고 영구 삭제를 실행합니다. 서버는 먼저 접속을 중단하고, 전용 Storage의 파일과 익명 Auth 사용자를 삭제한 뒤 명단·설문·추천·검수·문제·리허설·접속 연결·인증 시도·운영 로그를 삭제합니다. 운영자 계정과 개인정보 없는 기본 질문은 유지합니다.
4. 오류가 발생하면 접속은 중단된 상태로 남습니다. 같은 삭제를 다시 실행할 수 있습니다. 완료 전에는 파기 완료로 기록하지 않습니다.
5. Supabase SQL Editor에서 확인합니다.

```sql
select count(*) from private.employees;
select count(*) from public.surveys;
select count(*) from public.nominations;
select count(*) from private.sessions;
select count(*) from public.forest_posts;
select count(*) from private.forest_limits;
select count(*) from private.forest_owners;
select count(*) from auth.users where is_anonymous;
select count(*) from storage.objects where bucket_id='event-media';
```

모두 0이어야 합니다. 운영 로그는 파기 완료 기록 한 건만 남습니다. 서명 URL은 최대 60초 후 만료됩니다. 이미 내려받거나 캡처한 화면·파일은 서버에서 회수할 수 없으므로 운영자 다운로드 파일과 공유 위치도 정리합니다.

6. 개인정보가 포함될 수 있는 Supabase 백업·PITR·플랫폼 로그의 보관 기간을 확인합니다. 애플리케이션 삭제 버튼이 플랫폼 백업을 즉시 삭제하지는 않습니다. 행사 전용 프로젝트가 더 필요 없다면 보관 정책 확인 후 Supabase 프로젝트 삭제 절차를 따릅니다.
7. GitHub Pages 공개도 중단하려면 Settings → Pages에서 Unpublish site를 실행합니다. Actions 재배포가 다시 공개하지 않도록 워크플로도 중지합니다.

이 절차는 이 행사 **전용 Supabase 프로젝트**를 전제로 합니다. 삭제 기능은 프로젝트의 모든 익명 Auth 계정과 event-media 파일을 정리하므로 다른 앱과 프로젝트를 공유하지 않습니다. GitHub 저장소에는 운영 명단·답변·생년월일·코드·사진이 없어야 합니다.
