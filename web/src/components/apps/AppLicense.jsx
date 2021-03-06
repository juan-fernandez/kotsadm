import React, { Component } from "react";
import Helmet from "react-helmet";
import Dropzone from "react-dropzone";
import yaml from "js-yaml";
import classNames from "classnames";
import size from "lodash/size";

import {
  getLicenseExpiryDate,
} from "@src/utilities/utilities";

import { graphql, compose, withApollo } from "react-apollo";
import { getAppLicense } from "@src/queries/AppsQueries";
import { syncAppLicense } from "@src/mutations/AppsMutations";
import { getFileContent } from "../../utilities/utilities";
import Loader from "../shared/Loader";

import "@src/scss/components/apps/AppLicense.scss";

class AppLicense extends Component {

  constructor(props) {
    super(props);

    this.state = {
      appLicense: null,
      loading: false,
      message: "",
      messageType: "info"
    }
  }

  componentDidMount() {
    this.getAppLicense();
  }

  getAppLicense = () => {
    const { app } = this.props;
    this.props.client.query({
      query: getAppLicense,
      fetchPolicy: "no-cache",
      errorPolicy: "ignore",
      variables: {
        appId: app.id,
      }
    })
      .then(response => {
        if (response.data.getAppLicense === null) {
          this.setState({ appLicense: {} });
        } else {
          this.setState({ appLicense: response.data.getAppLicense });
        }
      });
  }

  onDrop = async (files) => {
    const content = await getFileContent(files[0]);
    const airgapLicense = yaml.safeLoad(content);
    const { appLicense } = this.state;

    if (airgapLicense.spec?.licenseID !== appLicense?.id) {
      this.setState({
        message: "Licenses do not match",
        messageType: "error"
      });
      return;
    }

    if (airgapLicense.spec?.licenseSequence === appLicense?.licenseSequence) {
      this.setState({
        message: "License is already up to date",
        messageType: "info"
      });
      return;
    }

    this.syncAppLicense(content);
  }

  syncAppLicense = (airgapLicense = "") => {
    this.setState({ loading: true, message: "", messageType: "info" });

    const { app } = this.props;
    this.props.syncAppLicense(app.slug, app.isAirgap ? airgapLicense : "")
      .then(response => {
        const latestLicense = response.data.syncAppLicense;
        const currentLicense = this.state.appLicense;

        let message;
        if (latestLicense.licenseSequence === currentLicense.licenseSequence) {
          message = "License is already up to date"
        } else if (app.isAirgap) {
          message = "License uploaded successfully"
        } else {
          message = "License synced successfully"
        }

        this.setState({ 
          appLicense: latestLicense,
          message,
          messageType: "info",
        });

        if (this.props.syncCallback) {
          this.props.syncCallback();
        }
      })
      .catch(err => {
        console.log(err);
        err.graphQLErrors.map(({ msg }) => {
          this.setState({
            message: msg,
            messageType: "error"
          });
        });
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  }

  render() {
    const { appLicense, loading, message, messageType } = this.state;

    if (!appLicense) {
      return (
        <div className="flex-column flex1 alignItems--center justifyContent--center">
          <Loader size="60" />
        </div>
      );
    }

    const { app } = this.props;
    const expiresAt = getLicenseExpiryDate(appLicense);


    return (
      <div className="flex flex-column justifyContent--center alignItems--center">
        <Helmet>
          <title>{`${app.name} License`}</title>
        </Helmet>
        {appLicense?.licenseType === "community" &&
          <div className="CommunityLicense--wrapper u-marginTop--30 flex flex1 alignItems--center">
            <div className="flex flex-auto">
              <span className="icon communityIcon"></span>
            </div>
            <div className="flex1 flex-column u-marginLeft--10">
              <p className="u-color--emperor u-fontSize--large u-fontWeight--bold u-lineHeight--medium u-marginBottom--5"> You are running a Community Edition of {app.name} </p>
              <p className="u-color--silverChalice u-fontSize--normal u-lineHeight--medium"> To change your license, please contact your account representative. </p>
            </div>
          </div>
        }
        {size(appLicense) > 0 ?
          <div className="LicenseDetails--wrapper u-textAlign--left u-paddingRight--20 u-paddingLeft--20">
            <div className="flex u-marginBottom--20 u-paddingBottom--5 u-marginTop--20 alignItems--center">
              <p className="u-fontWeight--bold u-color--tuna u-fontSize--larger u-lineHeight--normal u-marginRight--10">License details</p>
            </div>
            <div className="u-color--tundora u-fontSize--normal u-fontWeight--medium">
              <div className="flex u-marginBottom--20">
                <p className="u-marginRight--10">Expires:</p>
                <p className="u-fontWeight--bold u-color--tuna">{expiresAt}</p>
              </div>
              {appLicense.channelName &&
                <div className="flex u-marginBottom--20">
                  <p className="u-marginRight--10">Channel:</p>
                  <p className="u-fontWeight--bold u-color--tuna">{appLicense.channelName}</p>
                </div>
              }
              {appLicense.entitlements?.map(entitlement => {
                return (
                  <div key={entitlement.label} className="flex u-marginBottom--20">
                    <p className="u-marginRight--10">{entitlement.title}</p>
                    <p className="u-fontWeight--bold u-color--tuna">{entitlement.value}</p>
                  </div>
                );
              })}
              {app.isAirgap ?
                <Dropzone
                    className="Dropzone-wrapper"
                    accept={["application/x-yaml", ".yaml", ".yml"]}
                    onDropAccepted={this.onDrop}
                    multiple={false}
                  >
                  <button className="btn secondary blue u-marginBottom--10" disabled={loading}>{loading ? "Uploading" : "Upload license"}</button>
                </Dropzone> 
                :
                <button className="btn secondary blue u-marginBottom--10" disabled={loading} onClick={this.syncAppLicense}>{loading ? "Syncing" : "Sync license"}</button>
              }
              {message &&
                <p className={classNames("u-fontWeight--bold u-fontSize--small u-position--absolute", {
                  "u-color--red": messageType === "error",
                  "u-color--tuna": messageType === "info",
                })}>{message}</p>
              }
            </div>
          </div>
          :
          <div> 
            <p className="u-fontSize--large u-color--dustyGray u-marginTop--15 u-lineHeight--more"> License data is not available on this application because it was installed via Helm </p>
          </div>
        }
      </div>
    );
  }
}

export default compose(
  withApollo,
  graphql(syncAppLicense, {
    props: ({ mutate }) => ({
      syncAppLicense: (appSlug, airgapLicense) => mutate({ variables: { appSlug, airgapLicense } })
    })
  })
)(AppLicense);
