select *
from {{ ref('fct_gebied_year') }}
where livability_score not between 1 and 10
    or safety_score not between 1 and 10
