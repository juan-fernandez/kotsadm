import React from "react";
import createHistory from "history/createBrowserHistory";
import ReactPiwik from "react-piwik";
import { hot } from "react-hot-loader";
import { Switch, Route, Redirect, Router } from "react-router-dom";
import { ApolloProvider } from "react-apollo";
import { Utilities } from "./utilities/utilities";
import { ShipClientGQL } from "./ShipClientGQL";
import { Helmet } from "react-helmet";

import Login from "./components/Login";
import NotFound from "./components/static/NotFound";
import Footer from "./components/shared/Footer";
import NavBar from "./components/shared/NavBar";
import GitHubAuth from "./components/github_auth/GitHubAuth";
import Clusters from "./components/clusters/Clusters";
import CreateCluster from "./components/clusters/CreateCluster";
import WatchedApps from "./components/watches/WatchedApps";
import VersionHistory from "./components/watches/VersionHistory";
import DiffShipReleases from "./components/watches/DiffShipReleases";
import DiffGitHubReleases from "./components/watches/DiffGitHubReleases";
import ComingSoon from "./components/ComingSoon";
import StateFileViewer from "./components/state/StateFileViewer";
import Ship from "./components/Ship";
import ShipInitPre from "./components/ShipInitPre";
import ShipUnfork from "./components/ShipUnfork";
import ShipInitCompleted from "./components/ShipInitCompleted";
import WatchDetailPage from "./components/watches/WatchDetailPage";
import ClusterScope from "./components/clusterscope/ClusterScope";
import UnsupportedBrowser from "./components/static/UnsupportedBrowser";

// Import Ship Init component CSS first
import "@replicatedhq/ship-init/dist/styles.css";

import "./scss/index.scss";

const INIT_SESSION_ID_STORAGE_KEY = "initSessionId";

let history = createHistory();
if(process.env.NODE_ENV === "production") {
  const piwik = new ReactPiwik({
    url: "https://data-2.replicated.com",
    siteId: 6,
    trackErrors: true,
    jsFilename: "js/",
  });
  history = piwik.connectToHistory(history);
}

class ProtectedRoute extends React.Component {
  render() {
    return (
      <Route path={this.props.path} render={(innerProps) => {
        if (Utilities.isLoggedIn()) {
          if (this.props.component) {
            return <this.props.component {...innerProps} />;
          }
          return this.props.render(innerProps);
        }
        return <Redirect to={`/login?next=${this.props.location.pathname}${this.props.location.search}`} />;
      }} />
    )
  }
}

class Root extends React.Component {
  state = {
    initSessionId: Utilities.localStorageEnabled() ? localStorage.getItem(INIT_SESSION_ID_STORAGE_KEY) : "",
  };

  handleActiveInitSession = (initSessionId) => {
    if (Utilities.localStorageEnabled()) {
      localStorage.setItem(INIT_SESSION_ID_STORAGE_KEY, initSessionId)
    }
    this.setState({ initSessionId })
  }

  handleActiveInitSessionCompleted = () => {
    if (Utilities.localStorageEnabled()) {
      localStorage.removeItem(INIT_SESSION_ID_STORAGE_KEY);
    }
    this.setState({ initSessionId: "" });
  }

  handleInitCompletion = (history) =>
    () => {
      history.push("/watch/init/complete");
    }
  handleUpdateCompletion = history =>
    () => {
      history.push("/watches");
      this.handleActiveInitSessionCompleted()
    }

  render() {
    const { initSessionId } = this.state;

    return (
      <div className="flex-column flex1">
        <Helmet>
          <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
          <meta httpEquiv="Pragma" content="no-cache" />
          <meta httpEquiv="Expires" content="0" />
        </Helmet>
        <ApolloProvider client={ShipClientGQL(window.env.GRAPHQL_ENDPOINT, () => { return Utilities.getToken(); })}>
          <Router history={history}>
            <div className="flex-column flex1">
              <NavBar />
              <div className="flex-1-auto flex-column u-overflow--hidden">
                <Switch>
                  <Route exact path="/" component={() => <Redirect to={Utilities.isLoggedIn() ? "/watches" : "/login"} />} />
                  <Route exact path="/login" component={Login} />
                  <Route path="/auth/github" component={GitHubAuth} />
                  <Route exact path="/coming-soon" component={ComingSoon} />
                  <Route path="/clusterscope" component={ClusterScope} />
                  <Route path="/unsupported" component={UnsupportedBrowser} />
                  <ProtectedRoute path="/clusters" render={(props) => <Clusters {...props} />} />
                  <ProtectedRoute path="/cluster/create" render={(props) => <CreateCluster {...props} />} />
                  <ProtectedRoute path="/watches" render={(props) => <WatchedApps {...props} onActiveInitSession={this.handleActiveInitSession} />} />
                  <ProtectedRoute path="/watch/:owner/:slug/history/compare/:org/:repo/:branch/:rootPath/:firstSeqNumber/:secondSeqNumber" component={DiffGitHubReleases} />
                  <ProtectedRoute path="/watch/:owner/:slug/history/compare/:firstSeqNumber/:secondSeqNumber" component={DiffShipReleases} />
                  <ProtectedRoute path="/watch/:owner/:slug/history" component={VersionHistory} />
                  <ProtectedRoute path="/watch/create/init" render={(props) => <ShipInitPre {...props} onActiveInitSession={this.handleActiveInitSession} />} />
                  <ProtectedRoute path="/watch/create/unfork" render={(props) => <ShipUnfork {...props} onActiveInitSession={this.handleActiveInitSession} />} />
                  <ProtectedRoute path="/watch/create/state" component={() =>
                    <StateFileViewer
                      isNew={true}
                      headerText="Add your application's state.json file"
                      subText={<span>Paste in the state.json that was generated by Replicated Ship. If you need help finding your state.json file or you have not initialized your app using Replicated Ship, <a href="https://ship.replicated.com/docs/ship-init/storing-state/" target="_blank" rel="noopener noreferrer" className="replicated-link">check out our docs.</a></span>}
                    />
                  } />
                  <ProtectedRoute
                    path="/watch/init/complete"
                    render={
                      (props) => <ShipInitCompleted
                        {...props}
                        initSessionId={initSessionId}
                        onActiveInitSessionCompleted={this.handleActiveInitSessionCompleted}
                      />
                    }
                  />
                  <ProtectedRoute path="/watch/:owner/:slug/:tab?" render={(props) => <WatchDetailPage {...props} onActiveInitSession={this.handleActiveInitSession} />} />
                  <ProtectedRoute
                    path="/ship/init"
                    render={
                      (props) => <Ship
                        {...props}
                        rootURL={window.env.SHIPINIT_ENDPOINT}
                        initSessionId={initSessionId}
                        onCompletion={this.handleInitCompletion(props.history)}
                      />
                    }
                  />
                  <ProtectedRoute
                    path="/ship/update"
                    render={
                      (props) => <Ship
                        {...props}
                        rootURL={window.env.SHIPUPDATE_ENDPOINT}
                        initSessionId={initSessionId}
                        onCompletion={this.handleUpdateCompletion(props.history)}
                      />
                    }
                  />
                  <Route component={NotFound} />
                </Switch>
              </div>
              <div className="flex-auto Footer-wrapper u-width--full">
                <Footer />
              </div>
            </div>
          </Router>
        </ApolloProvider>
      </div>
    );
  }
}

export default hot(module)(Root)