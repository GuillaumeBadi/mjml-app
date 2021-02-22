import React, { Component } from 'react'
import cx from 'classnames'
import { Motion, spring } from 'react-motion'
import { connect } from 'react-redux'
import isEqual from 'lodash/isEqual'
import find from 'lodash/find'

import Button from 'components/Button'
import Iframe from 'components/Iframe'

import { updateSettings } from 'actions/settings'
import { addAlert } from 'reducers/alerts'
import { compile } from 'helpers/preview-content'

export default connect(
  state => ({
    preview: state.preview,
    previewSize: state.settings.get('previewSize'),
    templating: state.settings.get('templating'),
  }),
  {
    updateSettings,
    addAlert,
  },
)(
  class FilePreview extends Component {
    state = {
      content: '',
    }

    componentDidUpdate(prevProps) {
      const prev = {
        engine: this.getProjectVariables(prevProps).engine,
        variables: this.getProjectVariables(prevProps).variables,
        raw: prevProps.preview ? prevProps.preview.content : '',
      }

      const current = {
        engine: this.getProjectVariables(this.props).engine,
        variables: this.getProjectVariables(this.props).variables,
        raw: this.props.preview ? this.props.preview.content : '',
      }

      !isEqual(prev, current) && this.updateContent(current)
    }

    getProjectVariables = props => {
      const { templating, iframeBase } = props
      return find(templating, { projectPath: iframeBase }) || {}
    }

    updateContent = async params => {
      try {
        const content = await compile(params)
        this.setState({ content })
      } catch (err) {
        this.props.addAlert(`[Template Compiler Error] ${err.message}`, 'error')
        throw new Error(err)
      }
    }

    render() {
      const { preview, disablePointer, previewSize, onSetSize, iframeBase } = this.props
      const { content } = this.state

      return (
        <div className="FilesList--preview">
          {disablePointer && <div className="FilesList--preview-overlay abs" />}
          <Motion
            style={{
              op: spring(preview ? 1 : 0),
            }}
          >
            {m => (
              <div style={{ opacity: m.op }}>
                <div className="FileList--preview-actions-wrapper">
                  <div className="FileList--preview-actions">
                    <Button
                      ghost
                      className={cx({
                        isActive: previewSize.get('current') === previewSize.get('desktop'),
                      })}
                      onClick={() => onSetSize(previewSize.get('desktop'))}
                    >
                      {'Desktop'}
                    </Button>
                    <Button
                      ghost
                      className={cx({
                        isActive: previewSize.get('current') === previewSize.get('mobile'),
                      })}
                      onClick={() => onSetSize(previewSize.get('mobile'))}
                    >
                      {'Mobile'}
                    </Button>
                  </div>
                </div>
                {preview ? (
                  preview.type === 'html' ? (
                    <Iframe base={iframeBase} value={content} openLinks />
                  ) : preview.type === 'image' ? (
                    <img className="FileList--preview-image" src={`file://${preview.content}`} />
                  ) : null
                ) : null}
              </div>
            )}
          </Motion>
        </div>
      )
    }
  },
)
