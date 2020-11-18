import { appcd } from '@liveview/shared-utils';

jest.setTimeout(10000);

test('get', async (done) => {
  const response = await appcd.get('/appcd/status');
  expect(response.pid).toEqual(jasmine.any(Number));
  expect(response.version).toEqual(jasmine.any(String));
  appcd.close();
  done();
});

test('post', async (done) => {
  let response = await appcd.post<string>('/appcd/plugin/register', {
    path: __dirname
  });
  expect(response).toBe('Plugin path registered successfully');
  response = await appcd.post<string>('/appcd/plugin/unregister', {
    path: __dirname
  });
  expect(response).toBe('Plugin path unregistered successfully');
  appcd.close();
  done();
});

describe('subscription', () => {
  test('subscribe', async (done) => {
    const spy = jasmine.createSpy();
    const sub = await appcd.subscribe('/appcd/status/uptime');
    sub.on('message', spy);
    setTimeout(() => {
      expect(spy).toHaveBeenCalled();
      done();
    }, 200);
  });

  test('unsubscribe', async (done) => {
    const spy = jasmine.createSpy();
    const sub = await appcd.subscribe('/appcd/status/uptime');
    await sub.unsubscribe();
    sub.on('message', spy);
    setTimeout(() => {
      expect(spy).not.toHaveBeenCalled();
      done();
    }, 200);
  });
});
