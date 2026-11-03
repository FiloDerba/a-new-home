select
    cast(variabele as varchar) as indicator_id,
    cast(label as varchar) as label,
    cast(thema as varchar) as theme,
    cast(definitie as varchar) as definition,
    cast(bron as varchar) as source,
    cast(peildatum as varchar) as reference_date
from {{ source('amsterdam', 'indicators') }}
