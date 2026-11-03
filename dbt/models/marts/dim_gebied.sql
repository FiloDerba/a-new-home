-- The 25 gebiedsgericht-werken areas currently in force.
select gebied_code, name, geometry
from {{ ref('stg_gebieden__ggw_gebieden') }}
where is_current
