import { handleActions } from 'redux-actions'
import { Map, List } from 'immutable'
import uniq from 'lodash/uniq'

const state = null

export default handleActions(
  {
    SETTINGS_LOAD_SUCCESS: (state, { payload }) => {
      return Map({
        lastOpenedFolder: payload.lastOpenedFolder,
        projects: List(payload.projects),
        editor: Map(payload.editor),
        api: Map(payload.api),
        mjml: Map(payload.mjml),
        previewSize: Map(payload.previewSize),
        snippets: List(payload.snippets),
        previewContent: Map(payload.previewContent),
      })
    },

    UPDATE_SETTINGS: (state, { payload: updater }) => updater(state),

    ADD_TO_LAST_USED_EMAILS: (state, { payload: emails }) => {
      const lastEmails = uniq([...state.getIn(['api', 'LastEmails']), ...emails])
      // console.log(lastEmails)
      // return state.setIn(['api', 'LastEmails'], [])
      return state.setIn(['api', 'LastEmails'], lastEmails)
    },

    REMOVE_FROM_LAST_USED_EMAILS: (state, { payload: email }) => {
      return state.updateIn(['api', 'LastEmails'], lastEmails => {
        return lastEmails.filter(e => e !== email)
      })
    },

    PROJECT_LOAD: (state, { payload: { path } }) =>
      state.update('projects', p => {
        if (p.find(p => p === path)) {
          return state
        }
        return p.unshift(path)
      }),

    PROJECT_REMOVE: (state, { payload: path }) =>
      state.update('projects', projects => projects.filter(p => p !== path)),

    PROJECT_RENAME: (state, { payload: { oldPath, newPath } }) =>
      state.update('projects', projects =>
        projects.map(p => {
          if (p !== oldPath) {
            return p
          }
          return newPath
        }),
      ),

    PROJECTS_REMOVE: (state, { payload: paths }) =>
      state.update('projects', projects => projects.filter(p => paths.indexOf(p) === -1)),

    SNIPPET_ADD: (state, { payload: { snippetName, snippetTrigger, snippetContent } }) =>
      state.update('snippets', snippets =>
        snippets.unshift({
          name: snippetName,
          trigger: snippetTrigger,
          content: snippetContent,
        }),
      ),

    SNIPPET_UPDATE: (state, { payload: { oldName, newName, newTrigger, newContent } }) =>
      state.update('snippets', snippets => {
        const index = snippets.findIndex(s => s.name === oldName)
        return snippets.set(index, {
          name: newName,
          trigger: newTrigger,
          content: newContent,
        })
      }),

    SNIPPET_DELETE: (state, { payload: { snippetName } }) =>
      state.update('snippets', snippets => {
        const index = snippets.findIndex(s => s.name === snippetName)
        return snippets.delete(index)
      }),
  },
  state,
)
