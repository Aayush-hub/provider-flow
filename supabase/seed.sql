insert into public.organizations(slug,name,is_fictional,requirement_version,workflow) values
('northstar','Northstar Health Network',true,1,'{"stages":["intake_review","verification","credentialing_review"]}'),
('evergreen','Evergreen Medical Group',true,1,'{"stages":["intake_review","information_requested","verification","credentialing_review"]}'),
('horizon','Horizon Care Partners',true,1,'{"stages":["intake_review","verification","credentialing_review"]}')
on conflict (slug) do nothing;

insert into public.org_requirements(organization_id,version,canonical_key,label,conditional_rule,evidence_rule)
select id,1,'identity.npi','NPI',null,'{"classification":"publicly_reported"}' from public.organizations
union all select id,1,'professional.degree','Professional degree',null,'{}' from public.organizations
union all select id,1,'education.medical_school','Medical school',null,'{}' from public.organizations
union all select id,1,'license.active','Active state license',null,'{"document":"license"}' from public.organizations
on conflict do nothing;
