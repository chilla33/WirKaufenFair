import os
import sys
import base64
# ensure backend package is on path for tests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_admin_page_requires_basic_auth(monkeypatch):
    # set admin user/pass
    monkeypatch.setenv('ADMIN_USER', 'admin')
    monkeypatch.setenv('ADMIN_PASSWORD', 'pw')

    # request admin page without auth
    resp = client.get('/admin/product_locations.html')
    assert resp.status_code == 401

    # with wrong auth
    bad = base64.b64encode(b'wrong:creds').decode('ascii')
    resp = client.get('/admin/product_locations.html', headers={'Authorization': f'Basic {bad}'})
    assert resp.status_code == 401

    # with correct auth
    good = base64.b64encode(b'admin:pw').decode('ascii')
    resp = client.get('/admin/product_locations.html', headers={'Authorization': f'Basic {good}'})
    # static file may not exist in test env; expect 200 or 404 depending on mount; ensure not 401
    assert resp.status_code != 401


def test_api_vote_requires_api_key(monkeypatch):
    # set admin api key
    monkeypatch.setenv('ADMIN_API_KEY', 'secretkey')

    # create a suggestion to vote on
    payload = {
        'product_identifier': '000',
        'store_name': 's',
    }
    post = client.post('/api/v1/product_locations', json=payload)
    assert post.status_code == 200
    data = post.json()
    pid = data['id']

    # vote without header
    resp = client.post(f'/api/v1/product_locations/{pid}/vote', json={'vote': 'up'})
    assert resp.status_code == 401

    # vote with header
    resp = client.post(f'/api/v1/product_locations/{pid}/vote', json={'vote': 'up'}, headers={'X-API-KEY': 'secretkey'})
    assert resp.status_code == 200
