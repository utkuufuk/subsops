import sys
import json
import requests

LOCAL_PORT = 5000

if __name__ == "__main__":
    # read firebase app ID from .firebaserc to build local & remote endpoint addresses
    firebaserc = json.load(open('.firebaserc'))
    appId = firebaserc['projects']['default']
    localEndpoint = "http://localhost:" + str(LOCAL_PORT) + "/" + appId + "/us-central1/"
    remoteEndpoint = "https://us-central1-" + appId + ".cloudfunctions.net/"

    # read arguments & make a post request
    [_, endpoint, function, file] = sys.argv
    url = (localEndpoint if (endpoint == 'local') else remoteEndpoint) + function
    req = requests.post(url, json=json.load(open(file)))
    print("Server response:", req.status_code, "\n" + req.text)
