// @flow
import * as React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import VCS from '../../../sync/vcs';
import { batchModifyDocs } from '../../../common/database';
import type { StatusCandidate } from '../../../sync/types';
import PromptButton from '../base/prompt-button';
import SyncPullButton from '../sync-pull-button';

type Props = {
  workspace: Workspace,
  syncItems: Array<StatusCandidate>,
  vcs: VCS,
};

type State = {
  error: string,
  newBranchName: string,
  currentBranch: string,
  branches: Array<string>,
  remoteBranches: Array<string>,
};

@autobind
class SyncBranchesModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);
    this.state = {
      error: '',
      newBranchName: '',
      branches: [],
      remoteBranches: [],
      currentBranch: '',
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  async _handleCheckout(branch: string) {
    const { vcs, syncItems } = this.props;
    try {
      const delta = await vcs.checkout(syncItems, branch);
      await batchModifyDocs(delta);
      await this.refreshState();
    } catch (err) {
      this.setState({ error: err.message });
    }
  }

  async _handleRemoteDelete(branch: string) {
    const { vcs } = this.props;
    try {
      await vcs.removeRemoteBranch(branch);
      await this.refreshState();
    } catch (err) {
      this.setState({ error: err.message });
    }
  }

  async _handleDelete(branch: string) {
    const { vcs } = this.props;
    try {
      await vcs.removeBranch(branch);
      await this.refreshState();
    } catch (err) {
      this.setState({ error: err.message });
    }
  }

  async _handleCreate(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const { vcs, syncItems } = this.props;
    try {
      // Create new branch
      const { newBranchName } = this.state;
      await vcs.fork(newBranchName);

      // Checkout new branch
      const delta = await vcs.checkout(syncItems, newBranchName);
      await batchModifyDocs(delta);

      // Clear branch name and refresh things
      await this.refreshState({ newBranchName: '', error: '' });
    } catch (err) {
      this.setState({ error: err.message });
    }
  }

  _updateNewBranchName(e: SyntheticEvent<HTMLTextAreaElement>) {
    this.setState({ newBranchName: e.currentTarget.value });
  }

  _handleClearError() {
    this.setState({ error: '' });
  }

  async refreshState(newState?: Object) {
    const { vcs } = this.props;
    try {
      const currentBranch = await vcs.getBranch();
      const branches = (await vcs.getBranches()).sort();

      this.setState({
        branches,
        currentBranch,
        error: '',
        ...newState,
      });

      const remoteBranches = (await vcs.getRemoteBranches())
        .filter(b => !branches.includes(b))
        .sort();
      this.setState({ remoteBranches });
    } catch (err) {
      this.setState({ error: err.message });
    }
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { onHide: Function }) {
    this.modal && this.modal.show({ onHide: options.onHide });
    await this.refreshState();
  }

  render() {
    const { vcs } = this.props;
    const { branches, remoteBranches, currentBranch, newBranchName, error } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Branches</ModalHeader>
        <ModalBody className="wide pad">
          {error && (
            <p className="notice error margin-bottom-sm no-margin-top">
              <button className="pull-right icon" onClick={this._handleClearError}>
                <i className="fa fa-times" />
              </button>
              {error}
            </p>
          )}
          <form onSubmit={this._handleCreate}>
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  New Branch Name
                  <input
                    type="text"
                    onChange={this._updateNewBranchName}
                    placeholder="testing-branch"
                    value={newBranchName}
                  />
                </label>
              </div>
              <div className="form-control form-control--no-label width-auto">
                <button type="submit" className="btn btn--clicky" disabled={!newBranchName}>
                  Create
                </button>
              </div>
            </div>
          </form>

          <div className="pad-top">
            <table className="table--fancy table--outlined">
              <thead>
                <tr>
                  <th className="text-left">Branches</th>
                  <th className="text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(name => (
                  <tr key={name} className="table--no-outline-row">
                    <td>
                      <span className={classnames({ bold: name === currentBranch })}>{name}</span>
                      {name === currentBranch ? (
                        <span className="txt-sm space-left">(current)</span>
                      ) : null}
                      {name === 'master' && <i className="fa fa-lock space-left faint" />}
                    </td>
                    <td className="text-right">
                      <PromptButton
                        className="btn btn--micro btn--outlined space-left"
                        doneMessage="Deleted"
                        disabled={name === currentBranch || name === 'master'}
                        onClick={() => this._handleDelete(name)}>
                        Delete
                      </PromptButton>
                      <button
                        className="btn btn--micro btn--outlined space-left"
                        disabled={name === currentBranch}
                        onClick={() => this._handleCheckout(name)}>
                        Checkout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {remoteBranches.length > 0 && (
            <div className="pad-top">
              <table className="table--fancy table--outlined">
                <thead>
                  <tr>
                    <th className="text-left">Remote Branches</th>
                    <th className="text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {remoteBranches.map(name => (
                    <tr key={name} className="table--no-outline-row">
                      <td>
                        {name}
                        {name === 'master' && <i className="fa fa-lock space-left faint" />}
                      </td>
                      <td className="text-right">
                        {name !== 'master' && (
                          <PromptButton
                            className="btn btn--micro btn--outlined space-left"
                            doneMessage="Deleted"
                            disabled={name === currentBranch}
                            onClick={() => this._handleRemoteDelete(name)}>
                            Delete
                          </PromptButton>
                        )}
                        <SyncPullButton
                          className="btn btn--micro btn--outlined space-left"
                          branch={name}
                          onPull={this.refreshState}
                          disabled={name === currentBranch}
                          vcs={vcs}>
                          Fetch
                        </SyncPullButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncBranchesModal;