import {beforeEach,describe,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({getSession:vi.fn(),getUser:vi.fn()}));
vi.mock('../lib/supabase/client',()=>({createClient:()=>({auth})}));
import {requireLocalIdentity} from '../lib/db/offline-identity';
beforeEach(()=>{auth.getSession.mockReset();auth.getUser.mockReset();auth.getSession.mockResolvedValue({data:{session:{user:{id:'owner-A'}}}});auth.getUser.mockResolvedValue({data:{user:{id:'owner-B'}},error:null});});
describe('F02/F37 offline identity',()=>{
 it('local write does not require getUser network when a cached session exists',async()=>{expect((await requireLocalIdentity()).id).toBe('owner-A');expect(auth.getUser).not.toHaveBeenCalled();});
 it('remote delivery never accepts the cached owner instead of server verification',async()=>{expect((await requireLocalIdentity(true)).id).toBe('owner-B');expect(auth.getSession).not.toHaveBeenCalled();expect(auth.getUser).toHaveBeenCalledOnce();});
 it('missing/expired authentication cannot silently become another identity',async()=>{auth.getSession.mockResolvedValue({data:{session:null}});auth.getUser.mockResolvedValue({data:{user:null},error:new Error('expired')});await expect(requireLocalIdentity()).rejects.toThrow('AUTH_REQUIRED');});
});
