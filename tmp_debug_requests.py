import traceback
import json
from fastapi.testclient import TestClient
try:
    from backend.app.main import app
except Exception as e:
    print('Import error:', e)
    traceback.print_exc()
    raise SystemExit(1)

client = TestClient(app)

def call_get(path, params=None):
    try:
        r = client.get(path, params=params)
        print('\n=== GET', path, 'params=', params, 'status=', r.status_code)
        try:
            print(r.json())
        except Exception:
            print(r.text)
    except Exception as e:
        print('Exception calling', path, e)
        traceback.print_exc()


def call_post(path, jsonpayload=None):
    try:
        r = client.post(path, json=jsonpayload)
        print('\n=== POST', path, 'payload=', jsonpayload, 'status=', r.status_code)
        try:
            print(r.json())
        except Exception:
            print(r.text)
    except Exception as e:
        print('Exception calling', path, e)
        traceback.print_exc()

# Calls
call_get('/api/v1/product_locations')
call_get('/api/v1/price_reports/best_price', {'product_identifier':'4000540000108','store_name':'299973259'})
call_post('/api/v1/price_reports', {'product_identifier':'4000540000108','store_name':'299973259','reported_price':1.23})
