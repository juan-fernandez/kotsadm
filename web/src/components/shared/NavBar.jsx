import * as React from "react";
import { Link, withRouter } from "react-router-dom";
import { compose, withApollo, graphql } from "react-apollo";
import { Utilities } from "../../utilities/utilities";
import { userFeatures } from "../../queries/WatchQueries";
import { listWatches } from "../../queries/WatchQueries";
import { githubUser } from "../../queries/GitHubQueries";
import { logout } from "../../mutations/GitHubMutations";
import Avatar from "../shared/Avatar";

import "../../scss/components/shared/NavBar.scss";

export class NavBar extends React.Component {
  constructor() {
    super();
    this.state = {}
  }

  handleLogOut = async (e) => {
    e.preventDefault();
    await this.props.logout()
      .catch((err) => {
        console.log(err);
      })
    Utilities.logoutUser();
  }

  componentDidUpdate() {
    if (Utilities.isLoggedIn() && !this.state.user) {
      this.props.client.query({ query: githubUser })
        .then((res) => {
          this.setState({ user: res.data.githubUser });
        }).catch();
    }
  }

  componentDidMount() {
    if (Utilities.isLoggedIn()) {
      this.props.client.query({ query: githubUser })
        .then((res) => {
          this.setState({ user: res.data.githubUser });
        }).catch();
    }
  }

  handleGoToWatches = () => {
    if (this.props.location.pathname === "/watches") {
      this.props.client.query({
        query: listWatches,
        fetchPolicy: "network-only",
      });
    } else {
      this.props.history.push("/watches");
    }
  }

  handleGoToClusters = () => {
    if (this.props.location.pathname === "/clusters") {
      this.props.client.query({
        query: listWatches,
        fetchPolicy: "network-only",
      });
    } else {
      this.props.history.push("/clusters");
    }
  }

  render() {
    const { className } = this.props;
    const isClusterScope = this.props.location.pathname.includes("/clusterscope");

    return (
      <div className={`NavBarWrapper flex flex-auto ${className || ""}${isClusterScope && "cluster-scope"}`}>
        <div className="container flex flex1">
          <div className="flex1 justifyContent--flexStart">
            <div className="flex1 flex u-height--full">
              <div className="flex flex-auto">
                <div className="HeaderLogo-wrapper flex alignItems--center flex1 flex-verticalCenter u-position--relative">
                  <div className="HeaderLogo">
                    <Link to={`${isClusterScope ? "/clusterscope" : "/"}`} tabIndex="-1">
                      <span className="logo icon clickable"></span>
                      <span className="text flex-column justifyContent--center">
                        { isClusterScope ?
                          <span>
                            ClusterScope
                          </span> :
                          <span>Replicated Ship</span>
                        }
                      </span>
                    </Link>
                  </div>
                </div>
                {Utilities.isLoggedIn() ?
                  <div className="flex flex-auto left-items">
                    <div className="NavItem u-position--relative flex">
                      <span className="HeaderLink flex flex1 u-cursor--pointer" onClick={this.handleGoToWatches}>
                        <span className="text u-color--white u-fontSize--normal u-fontWeight--medium flex-column justifyContent--center">
                          <span>Watched apps</span>
                        </span>
                      </span>
                    </div>
                    <div className="NavItem u-position--relative flex ${clustersEnabled">
                      <span className="HeaderLink flex flex1 u-cursor--pointer" onClick={this.handleGoToClusters}>
                        <span className="text u-color--white u-fontSize--normal u-fontWeight--medium flex-column justifyContent--center">
                          <span>Clusters</span>
                        </span>
                      </span>
                    </div>
                  </div>
                  : null}
              </div>
              {this.props.location.pathname === "/coming-soon" ?
                <div className="flex flex1 justifyContent--flexEnd right-items">
                  <div className="flex-column flex-auto justifyContent--center">
                    <p className="NavItem" onClick={this.handleLogOut}>Log out</p>
                  </div>
                </div>
                : null}
              {Utilities.isLoggedIn() ?
                <div className="flex flex1 justifyContent--flexEnd right-items">
                  <div className="flex-column flex-auto justifyContent--center">
                    <p data-qa="Navbar--logOutButton" className="NavItem" onClick={this.handleLogOut}>Log out</p>
                  </div>
                  <div className="flex-column flex-auto justifyContent--center u-marginLeft--10">
                    <Avatar imageUrl={this.state.user && this.state.user.avatar_url} />
                  </div>
                </div>
                : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default compose(
  withRouter,
  withApollo,
  graphql(logout, {
    props: ({ mutate }) => ({
      logout: () => mutate()
    })
  }),
  graphql(userFeatures, {
    name: "userFeaturesQuery",
    skip: !Utilities.isLoggedIn()
  })
)(NavBar);