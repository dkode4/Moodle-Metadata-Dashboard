import csv
from datetime import datetime
import re

INPUT_FILE = 'DATA_RAW.csv'

def parse_date(time_str):
    match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{2}),\s*(\d{1,2}):(\d{1,2}):(\d{2})', time_str)
    if not match:
        return None
    try:
        d, m, y, H, M, S = map(int, match.groups())
        return datetime(2000 + y, m, d, H, M, S)
    except Exception:
        return None

invalid_rows = []
valid_count = 0
invalid_count = 0
invalid_row_nums = []

with open(INPUT_FILE, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header_skipped = False
    row_num = 0
    for row in reader:
        row_num += 1
        if not header_skipped:
            header_skipped = True
            continue
        reasons = []
        time_str = row[0] if len(row) > 0 else ''
        user = row[1] if len(row) > 1 else ''
        event = row[5] if len(row) > 5 else ''
        if not time_str:
            reasons.append('missingTime')
        elif not parse_date(time_str):
            reasons.append('badDateFormat')
        if not user.strip():
            reasons.append('missingUser')
        if not event.strip():
            reasons.append('missingEvent')
        if reasons:
            invalid_count += 1
            invalid_rows.append({'row': row_num, 'reasons': reasons, 'raw': row})
            invalid_row_nums.append(row_num)
        else:
            valid_count += 1

with open('script1_invalid_rows.txt', 'w', encoding='utf-8') as f_out:
    for num in invalid_row_nums:
        f_out.write(f"{num}\n")

print(f'Valid rows: {valid_count}')
print(f'Invalid rows: {invalid_count}')
for entry in invalid_rows:
    print(f"Row {entry['row']}: {entry['reasons']} -> {entry['raw']}")