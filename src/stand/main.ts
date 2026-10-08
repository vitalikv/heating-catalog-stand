import GUI from 'lil-gui';
import { Viewer } from './Viewer';

const viewport = document.getElementById('viewport');
const info = document.getElementById('info');
if (!viewport || !info) throw new Error('Не найдена разметка стенда');

const viewer = new Viewer(viewport);

const gui = new GUI({ title: 'Стенд' });
const view = gui.addFolder('Вид');
view.add(viewer.grid, 'visible').name('Сетка');
view.add(viewer.axes, 'visible').name('Оси');

info.textContent = 'Генераторы ещё не подключены';
