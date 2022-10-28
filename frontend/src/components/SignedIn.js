import { Typography, Stack } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import jwt_decode from "jwt-decode";
import { ReactComponent as Tick } from "../tick.svg";

export default function SignedIn() {
  const searchParams = useLocation();
  const [paramInfo, setParamInfo] = useState({});
  const [stateInfo, setStateInfo] = useState({});

  const sendInformationToSecondScreen = (params) => {
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.idToken}`,
      },
      body: JSON.stringify(params),
    };

    return fetch("https://api.podginator.com/send", requestOptions);
  };

  useEffect(() => {
    const { hash } = searchParams;
    const qryParam = new URLSearchParams(hash.slice(1));

    const params = {
      accessToken: qryParam.get("access_token"),
      idToken: qryParam.get("id_token"),
    };
    setParamInfo({
      accessToken: qryParam.get("access_token"),
      idToken: qryParam.get("id_token"),
    });
    const state = JSON.parse(atob(qryParam.get("state")));
    setStateInfo(state);

    if (window.location.hash) {
      window.history.replaceState("", document.title, window.location.pathname);
    }

    sendInformationToSecondScreen({ ...params, ...state });
  }, []);

  const renderSelection = () => {
    const renderName = () => {
      const jwtToken = jwt_decode(paramInfo.idToken);
      const fullName = `${jwtToken.given_name} ${jwtToken.family_name}`;

      return (
        <Typography component="h1" variant="h4" fontWeight={500} mt="20px">
          Signed in as <span style={{ color: "#ffd78f" }}>{fullName}</span>
        </Typography>
      );
    };
    if (paramInfo.idToken) {
      return (
        <div>
          <Stack
            spacing={2}
            textAlign={"center"}
            direction="row"
            justifyContent="center"
          >
            <Tick
              style={{ height: "50%", width: "50%" }}
              textAlign="center"
            ></Tick>
          </Stack>
          <Stack
            spacing={2}
            textAlign={"center"}
            direction="row"
            justifyContent="center"
          >
            <div>{renderName()}</div>
          </Stack>
        </div>
      );
    }

    return null;
  };

  return <div>{renderSelection()}</div>;
}
