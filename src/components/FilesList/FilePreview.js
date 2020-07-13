import React, { Component } from 'react'
import cx from 'classnames'
import { Motion, spring } from 'react-motion'
import { connect } from 'react-redux'
import { MdBuild as IconBuild } from 'react-icons/md'
import isEqual from 'lodash/isEqual'

import Button from 'components/Button'
import Iframe from 'components/Iframe'

import { updateSettings } from 'actions/settings'
import { addAlert } from 'reducers/alerts'
import { compile } from 'helpers/preview-content'

import PreviewSettings from './PreviewSettings'

export default connect(
  state => ({
    preview: state.preview,
    previewSize: state.settings.get('previewSize'),
    previewContent: state.settings.get('previewContent'),
  }),
  {
    updateSettings,
    addAlert,
  },
)(
  class FilePreview extends Component {
    state = {
      showSettings: false,
      content: '',
    }

    componentDidUpdate(prevProps) {
      const prev = {
        engine: prevProps.previewContent.get('engine'),
        variables: prevProps.previewContent.get('variables'),
        raw: prevProps.preview ? prevProps.preview.content : '',
      }

      const current = {
        engine: this.props.previewContent.get('engine'),
        variables: this.props.previewContent.get('variables'),
        raw: this.props.preview ? this.props.preview.content : '',
      }

      !isEqual(prev, current) && this.updateContent(current)
    }

    handleOpenSettings = () => this.setState({ showSettings: true })

    handleCloseSettings = () => this.setState({ showSettings: false })

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
      const { showSettings, content } = this.state

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
                  <div className="FilePreview--settings-button">
                    <Button ghost onClick={this.handleOpenSettings}>
                      <IconBuild />
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

          <PreviewSettings isOpened={showSettings} onClose={this.handleCloseSettings} />
        </div>
      )
    }
  },
)
