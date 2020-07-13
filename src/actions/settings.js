import storage from 'electron-json-storage'
import { promisify } from 'es6-promisify'
import defaultsDeep from 'lodash/defaultsDeep'
import omit from 'lodash/omit'

import { setError } from 'reducers/error'

const storageGet = promisify(storage.get)
const storageSet = promisify(storage.set)

export function loadSettings() {
  return async dispatch => {
    let shouldResetDefaults = false
    let res
    try {
      res = await storageGet('settings')

      // check for old format and reformat
      if (typeof res.projects === 'object' && !(res.projects instanceof Array)) {
        res = res.projects
        await storageSet('settings', res)
      }
    } catch (e) {
      shouldResetDefaults = true
      dispatch(setError(e))
    }

    const settings = defaultsDeep(res, {
      lastOpenedFolder: null,
      editor: {
        wrapLines: true,
        autoFold: false,
        foldLevel: 1,
        highlightTag: false,
        lightTheme: false,
        useTab: false,
        tabSize: 2,
        indentSize: 2,
        preventAutoSave: false,
      },
      mjml: {
        minify: false,
        beautify: false,
        keepComments: true,
        checkForRelativePaths: false,
      },
      projects: [],
      api: {
        Subject: 'MJML App test email',
        APIKey: '',
        APISecret: '',
        SenderName: 'MJML App',
        SenderEmail: '',
        TargetEmails: [],
        LastEmails: [],
      },
      previewSize: {
        current: 500,
        mobile: 320,
        desktop: 650,
      },
      snippets: [],
      previewContent: {
        engine: 'html',
        variables: {},
      },
    })

    // clean old format for TargetEmails
    if (settings.api.TargetEmail) {
      const updatedApiSettings = omit(settings.api, 'TargetEmail')
      settings.api = updatedApiSettings
    }

    dispatch({ type: 'SETTINGS_LOAD_SUCCESS', payload: settings })

    if (shouldResetDefaults) {
      dispatch(saveSettings())
    }
  }
}

export function saveSettings() {
  return (dispatch, getState) => {
    // prevent blocking the main thread
    // for no reason
    window.requestIdleCallback(() => {
      const state = getState()
      const settings = state.settings.toJS()
      dispatch({
        type: 'SAVE_SETTINGS',
        payload: settings,
      })
      storage.set('settings', settings)
    })
  }
}

export function cleanBadProjects(pathsToClean) {
  return {
    type: 'PROJECTS_REMOVE',
    payload: pathsToClean,
  }
}

export function updateSettings(updater) {
  return dispatch => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: updater,
    })
    dispatch(saveSettings())
  }
}

export function saveLastExportedFolder(path) {
  return dispatch => {
    dispatch(
      updateSettings(settings => {
        return settings.set('lastExportedFolder', path)
      }),
    )
  }
}

export function saveLastOpenedFolder(path) {
  return dispatch => {
    dispatch(
      updateSettings(settings => {
        return settings.set('lastOpenedFolder', path)
      }),
    )
  }
}

export function addToLastUsedEmails(emails) {
  return {
    type: 'ADD_TO_LAST_USED_EMAILS',
    payload: emails,
  }
}

export function removeFromLastUsedEmails(email) {
  return dispatch => {
    dispatch({
      type: 'REMOVE_FROM_LAST_USED_EMAILS',
      payload: email,
    })
    dispatch(saveSettings())
  }
}
