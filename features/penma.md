# rule
###
if div is only flex: 1 ==> auto layout veritcal
._content_lr8cs_1 {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
}

###
export figma json:
marginBottom is missing.

###
if div
._grid_1smf8_35 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
}
use auto layout is grid and format grid-template-columns

###
If a div has no flex or grid,
and contains multiple elements,
the default is auto-layout vertical.

###
._cardHeader_1smf8_12 {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
}
when import, also support border