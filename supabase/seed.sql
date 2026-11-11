-- Local-only synthetic employees. NEVER run this seed in the production project.
insert into private.employees(employee_no,name,department,dob,code_hash) values
 ('TEST-001','가상직원 하나','기획팀','1990-01-01',extensions.crypt('TEST2026-A1',extensions.gen_salt('bf',10))),
 ('TEST-002','가상직원 둘','개발팀','1991-02-02',extensions.crypt('TEST2026-B2',extensions.gen_salt('bf',10))),
 ('TEST-003','가상직원 셋','디자인팀','1992-03-03',extensions.crypt('TEST2026-C3',extensions.gen_salt('bf',10))),
 ('TEST-004','가상직원 넷','운영팀','1993-04-04',extensions.crypt('TEST2026-D4',extensions.gen_salt('bf',10))),
 ('TEST-005','가상직원 다섯','경영지원팀','1994-05-05',extensions.crypt('TEST2026-E5',extensions.gen_salt('bf',10)));
insert into public.employee_directory select id,name,department,active from private.employees;
