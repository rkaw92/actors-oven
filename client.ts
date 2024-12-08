const socket = new WebSocket("ws://localhost:3000");

socket.addEventListener('open', function () {
    setInterval(function () {
        socket.send(JSON.stringify({ name: 'Joe' }));
    }, 1000);
});
