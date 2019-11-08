import socketio

host = 'localhost'
port = 3000


devSocket = socketio.Client()
devSocket.connect('http://' + host + ':' + str(port))

devSocket.emit('login', {'passwd': '1234'})
0
@devSocket.on('dvid')
def divd(data):
    print(data)

devSocket.wait()
