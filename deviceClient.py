import socketio
import time
import string
import random

host = 'localhost'
port = 3000
validLogin = False

strPool = string.ascii_letters
def randstr(strLen):
    result = ''
    for i in range(strLen):
        result = result + random.choice(strPool)

    return result

def logging(dSocket):
    logData = randstr(10)
    dSocket.emit('deviceLog', {'logData': logData})
    
    
devSocket = socketio.Client()
devSocket.connect('http://' + host + ':' + str(port))

devSocket.emit('login', {'passwd': 'test', 'dvid': 1})

@devSocket.on('valid')
def valid(data):
    global validLogin
    validLogin = data
    print(str(data))

time.sleep(0.5)
logging(devSocket)


'''
while not validLogin:
    print("staying")
    time.sleep(0.5)
'''

'''
if validLogin:
    devSocket.emit('setOnline', {'dvid': 1})
'''

devSocket.wait()
