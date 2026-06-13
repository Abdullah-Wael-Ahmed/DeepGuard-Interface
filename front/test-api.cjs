const axios = require('axios');

async function test() {
    try {
        console.log("Fetching playbook...");
        const res = await axios.get('http://localhost:5000/playbooks/1');
        const playbook = res.data;
        console.log("Playbook fetched:", playbook.name);

        console.log("Attempting to save playbook...");
        const putRes = await axios.put('http://localhost:5000/playbooks/1', playbook);
        console.log("Save successful:", putRes.status);
    } catch (e) {
        if (e.response) {
            console.error("Save failed with status:", e.response.status);
            console.error("Response data:", e.response.data);
        } else {
            console.error("Save failed:", e.message);
        }
    }

    try {
        console.log("Attempting to execute playbook...");
        const execRes = await axios.post('http://localhost:5000/playbooks/1/execute', { src_ip: '10.0.0.99' });
        console.log("Execute successful:", execRes.status);
    } catch (e) {
        if (e.response) {
            console.error("Execute failed with status:", e.response.status);
            console.error("Response data:", e.response.data);
        } else {
            console.error("Execute failed:", e.message);
        }
    }
}

test();
