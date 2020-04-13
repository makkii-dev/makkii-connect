type Callback = (...data: any[]) => any;

type SessionStatus = {
    isConnect: boolean; // is connect to mobile
    isAlive: boolean; // is mobile socket alive
    isExired: boolean; // is signature expired
    browserId: string; // browser socket id
    mobileId: string; // mobile socket id
};
