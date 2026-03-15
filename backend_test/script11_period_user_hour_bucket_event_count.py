import csv
from datetime import datetime, timedelta

INPUT_FILE = 'CLEANED_DATA.csv'

period_type = input("Enter period type (day/week/month/year): ").strip().lower()
period_value = input("Enter period value: ").strip()
user_name = input("Enter user name: ").strip()
hour_bucket = input("Enter hour bucket: ").strip()

event_count = 0

bucket_ranges = [
    ('00-03', range(0, 3)),
    ('03-06', range(3, 6)),
    ('06-09', range(6, 9)),
    ('09-12', range(9, 12)),
    ('12-15', range(12, 15)),
    ('15-18', range(15, 18)),
    ('18-21', range(18, 21)),
    ('21-00', list(range(21, 24)) + [0])
]

def parse_date(time_str):
    try:
        return datetime.strptime(time_str, '%d/%m/%y, %H:%M:%S')
    except Exception:
        return None

def match_period(date_obj):
    if period_type == 'day':
        try:
            target = datetime.strptime(period_value, '%d-%m-%Y')
        except Exception:
            return False
        return date_obj.date() == target.date()
    elif period_type == 'month':
        try:
            target = datetime.strptime(period_value, '%m-%Y')
        except Exception:
            return False
        return date_obj.month == target.month and date_obj.year == target.year
    elif period_type == 'year':
        try:
            target_year = int(period_value)
        except Exception:
            return False
        return date_obj.year == target_year
    elif period_type == 'week':
        try:
            target = datetime.strptime(period_value, '%d-%m-%Y')
        except Exception:
            return False
        week_start = target - timedelta(days=target.weekday())
        week_end = week_start + timedelta(days=6)
        return week_start.date() <= date_obj.date() <= week_end.date()
    else:
        return False

def get_bucket(hour):
    for bucket, hours in bucket_ranges:
        if hour in hours:
            return bucket
    return None

with open(INPUT_FILE, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header_skipped = False
    for row in reader:
        if not header_skipped:
            header_skipped = True
            continue
        if len(row) > 0:
            time_str = row[0].strip()
            user = row[1].strip() if len(row) > 1 else ''
            date_obj = parse_date(time_str)
            if date_obj and match_period(date_obj) and user == user_name:
                hour = date_obj.hour
                bucket = get_bucket(hour)
                if bucket == hour_bucket:
                    event_count += 1

print(f"Period: {period_type} {period_value}")
print(f"User name: {user_name}")
print(f"Hour bucket: {hour_bucket}")
print(f"Number of events: {event_count}")