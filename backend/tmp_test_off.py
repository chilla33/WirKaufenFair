from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
resp = c.get('/api/v1/openfoodfacts/autocomplete?query=milch&limit=3')
print('status', resp.status_code)
try:
    print(resp.json())
except Exception as e:
    print('json error', e)
