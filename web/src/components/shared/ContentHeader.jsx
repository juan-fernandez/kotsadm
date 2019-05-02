import * as React from "react";
import { Link } from "react-router-dom";
import SearchWatchesBar from "./SearchWatchesBar";

export default class ContentHeader extends React.Component {

  render() {
    return (
      <div className="ContentHeader--wrapper u-marginTop--20 flex-auto">
        <div className="flex justifyContent--spaceBetween u-paddingBottom--10 u-marginBottom--30 u-borderBottom--gray">
          <div className="flex alignItems--center flex1">
            <h2 className="u-fontSize--larger u-fontWeight--bold u-color--tuna u-marginRight--20">{this.props.title}</h2>
            {this.props.searchCallback && <SearchWatchesBar searchCallback={(watches) => this.props.searchCallback(watches) }/>}
          </div>
          {this.props.showUnfork && <Link className="btn secondary flex alignItems--center u-marginRight--10" to="/watch/create/unfork"><span className="icon u-betaBadge u-marginRight--10"></span>Unfork Application</Link> }
          {this.props.buttonText && <button type="button" onClick={this.props.onClick} className="btn primary">{this.props.buttonText}</button>}
        </div>
      </div>
    );
  }
}