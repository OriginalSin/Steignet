import App from './App.html';

let pars = (() => {
	let p = {};
	location.search.substr(1).split('&').forEach((it) => {
		let arr = it.split('=');
		p[arr[0]] = arr[1];
	});
	return p;
})();

const app = new App({
	target: document.body,
	data: {
		urlParams: pars
	}
});

export default app;