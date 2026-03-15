import csv
from datetime import datetime, timedelta

INPUT_FILE = 'CLEANED_DATA.csv'

period_type = input("Enter period type (day/week/month/year): ").strip().lower()
period_value = input("Enter period value: ").strip()
event_name = input("Enter event name: ").strip()

action_count = 0

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

with open(INPUT_FILE, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header_skipped = False
    for row in reader:
        if not header_skipped:
            header_skipped = True
            continue
        if len(row) > 0:
            time_str = row[0].strip()
            event = row[5].strip() if len(row) > 5 else ''
            date_obj = parse_date(time_str)
            if date_obj and match_period(date_obj) and event == event_name:
                action_count += 1

print(f"Period: {period_type} {period_value}")
print(f"Event name: {event_name}")
print(f"Number of actions: {action_count}")