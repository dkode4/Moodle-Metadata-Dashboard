import csv

INPUT_FILE = 'CLEANED_DATA.csv'

unique_users = set()

with open(INPUT_FILE, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header_skipped = False
    for row in reader:
        if not header_skipped:
            header_skipped = True
            continue
        if len(row) > 1:
            user = row[1].strip()
            if user:
                unique_users.add(user)

print(f"Total unique users: {len(unique_users)}")