
import $ from 'jquery';
import axios from 'axios';
import 'bootstrap';
import normalizeUrl from 'normalize-url';
import 'bootstrap/dist/css/bootstrap.min.css';
import isURL from 'validator/lib/isURL';
import { watch } from 'melanke-watchjs';
import parseRssChannel from './rssParser';
import { renderChannel, renderNewsItem } from './renderers';
import { renderInputState, appendNews, deleteNews, prependRssName, renderModalDescription, renderModalTitle, deleteChannelNames } from './view';
import getState from './state';
import localSaver from './localSaver';

export default () => {
  const rssInputElement = $('#url-input');
  const rssInputButton = $('#url-form-button');
  const modal = $('#exampleModal');
  const rssNameList = $('#rssNameList');
  const newsList = $('#newsList');
  const state = getState();

  const loadLocalData = () => {
    if (localSaver.loadSavedNews()) state.addedNews = localSaver.loadSavedNews();
    if (localSaver.loadSavedChannels()) state.addedChannels = localSaver.loadSavedChannels();
  };

  const CORS_PROXY_URL = 'https://cors-anywhere.herokuapp.com/';

  const validateURL = (str) => {
    if (isURL(str.trim().toLowerCase())) {
      state.inputState.state = 'correct';
    } else if (str.trim().length === 0) {
      state.inputState.state = 'done';
    } else {
      state.inputState.message = 'invalide URL';
      state.inputState.state = 'error';
    }
  };

  const loadRSS = (rssUrl, corsProxy, isUpdated) => {
    if (!isUpdated) state.inputState.state = 'wait';
    const url = normalizeUrl(rssUrl, { forceHttp: true }).trim();
    return axios.get(`${corsProxy}${url}`, { timeout: 10000 })
      .then((response) => {
        const channel = { ...parseRssChannel(response.data), link: url };
        if (!isUpdated) {
          if (!state.hasChannel(channel)) {
            state.addedChannels = [...state.addedChannels, channel];
            state.addedNews = [...channel.items, ...state.addedNews];
            state.inputState.state = 'done';
          } else throw new Error('is already added Channel');
        } else {
          channel.items = channel.items.filter(item => !state.hasNewsItem(item));
          state.addedNews = [...channel.items, ...state.addedNews];
        }
      })
      .catch((err) => {
        if (!isUpdated) {
          state.inputState.message = err;
          state.inputState.state = 'error';
        }
      });
  };

  const updateNews = () => {
    const promises = state.addedChannels.map(channel =>
      loadRSS(channel.link, CORS_PROXY_URL, true));
    window.setTimeout(() => Promise.all(promises).finally(updateNews), 20000);
  };

  watch(state, 'addedNews', () => {
    deleteNews(newsList);
    state.addedNews.forEach((e) => {
      appendNews(newsList, renderNewsItem(e));
    });
    localSaver.saveNews(state.addedNews);
  });

  watch(state, 'addedChannels', () => {
    deleteChannelNames(rssNameList);
    state.addedChannels.forEach((e) => {
      prependRssName(rssNameList, renderChannel(e));
    });
    localSaver.saveChannels(state.addedChannels);
  });

  watch(state.inputState, 'state', () => {
    renderInputState(
      rssInputElement, rssInputButton,
      state.inputState.state, state.inputState.message,
    );
  });

  watch(state.modal, 'modalDescription', () => {
    renderModalDescription(modal, state.modal.modalDescription);
  });

  watch(state.modal, 'modalTitle', () => {
    renderModalTitle(modal, state.modal.modalTitle);
  });

  rssInputElement.on('keyup', () => {
    validateURL(rssInputElement.val());
  });
  rssInputButton.on('click', () => {
    loadRSS(rssInputElement.val(), CORS_PROXY_URL, false);
  });

  modal.on('show.bs.modal', (event) => {
    const id = $(event.relatedTarget).attr('id');
    const item = state.getItemFromGuid(id);
    const { description, title } = item;
    state.modal.modalDescription = description;
    state.modal.modalTitle = title;
  });
  modal.on('hide.bs.modal', () => {
    state.modal.modalDescription = ' ';
    state.modal.modalTitle = ' ';
  });

  loadLocalData();
  updateNews();
};

