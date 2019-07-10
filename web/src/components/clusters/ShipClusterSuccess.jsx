import * as React from "react";
import "../../scss/components/clusters/CreateCluster.scss";

export default class ShipClusterSuccess extends React.Component {
  render() {
    const { handleCreattionSuccessClick } = this.props;
    return (
      <div className="CreateCluster--wrapper flex-auto">
        <div className="flex1 flex-column">
          <p className="u-fontSize--large u-color--tuna u-fontWeight--bold u-lineHeight--normal">You cluster has been created with Ship</p>
          <p className="u-fontSize--normal u-fontWeight--medium u-color--dustyGray u-lineHeight--normal u-marginBottom--5">You can run this command to deploy your app to your cluster.</p>
          <code className="u-lineHeight--normal u-fontSize--small u-overflow--auto">
            kubectl apply -f {`${window.env.INSTALL_ENDPOINT}/${this.props.clusterId}/${this.props.token}`}
          </code>
        </div>
        <div className="flex-auto u-marginTop--20 u-textAlign--center">
          <span onClick={handleCreattionSuccessClick} className="btn primary large">Ok, got it!</span>
        </div>
      </div>
    );
  }
}
